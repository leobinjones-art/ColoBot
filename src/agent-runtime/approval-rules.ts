/**
 * 多层审批漏斗 - Tirith 规则引擎
 *
 * 四层漏斗：
 * 1. Tirith 规则 — 精确 regex/keyword 匹配，毫秒级，无 LLM
 * 2. Pattern 历史 — 过去 7 天同类工具调用频率，高频=高风险
 * 3. 用户行为自进化 — 基于用户历史批准/拒绝次数自动决策
 * 4. Smart LLM 裁决 — 兜底
 *
 * 决策结果：
 * - auto_reject    — 直接拒绝，无审批
 * - auto_approve  — 直接放行，无审批
 */

import { query, queryOne } from '../memory/db.js';
import type { ContentBlock, TextContent } from '../llm/index.js';
import type { ToolCall } from './tools/executor.js';

export type DecisionLevel = 'auto_reject' | 'auto_approve';

export interface DecisionResult {
  level: DecisionLevel;
  isCommercialDocument: boolean;  // true 时输出需附免责声明
}

interface ApprovalRule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  pattern_type: 'regex' | 'keyword';
  action: 'reject' | 'approve' | 'require_approval';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  user_approve_count: number;
  user_reject_count: number;
  auto_approve_threshold: number;
  auto_reject_threshold: number;
  confidence_decay_days: number;
  last_decided_at: Date | null;
  priority: number;  // 越小优先级越高
}

// ─── 商业文书标识（需在 checkDangerousLevel 前定义） ─────────────────────────

const COMMERCIAL_DOC_PATTERNS = [
  '合同', '协议', 'contract', 'agreement', '条款', 'terms',
  '保密协议', 'nda', '采购合同', '销售合同', '租赁合同',
  '授权书', '委托书', 'letter of', 'mou', 'memo of understanding',
];

export function isCommercialDocument(argsStr: string): boolean {
  const lower = argsStr.toLowerCase();
  return COMMERCIAL_DOC_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

// ─── 辅助函数 ────────────────────────────────────────────────────────────────

async function findMatchingRule(toolName: string, argsStr: string): Promise<ApprovalRule | null> {
  const rules = await query<ApprovalRule>(
    `SELECT * FROM approval_rules WHERE enabled = true ORDER BY priority ASC`
  );
  for (const rule of rules) {
    try {
      const matchStr = toolName + ' ' + argsStr;
      if (rule.pattern_type === 'regex' && new RegExp(rule.pattern, 'i').test(matchStr)) return rule;
      if (rule.pattern_type === 'keyword' && matchStr.toLowerCase().includes(rule.pattern.toLowerCase())) return rule;
    } catch {}
  }
  return null;
}

export async function getEvolutionStatus(ruleId: string): Promise<{
  approveCount: number; rejectCount: number;
  autoApprove: boolean; autoReject: boolean;
} | null> {
  const row = await queryOne<{
    user_approve_count: string; user_reject_count: string;
    auto_approve_threshold: string; auto_reject_threshold: string;
    confidence_decay_days: string; last_decided_at: Date | null;
  }>(
    `SELECT user_approve_count, user_reject_count, auto_approve_threshold, auto_reject_threshold,
            confidence_decay_days, last_decided_at
     FROM approval_rules WHERE id = $1`, [ruleId]
  );
  if (!row) return null;
  const decayDays = parseInt(row.confidence_decay_days ?? '14');

  // 置信度衰减：若超过 decay 天数未决策，计数减半
  let approveCount = parseInt(row.user_approve_count);
  let rejectCount = parseInt(row.user_reject_count);
  if (row.last_decided_at) {
    const elapsed = (Date.now() - new Date(row.last_decided_at).getTime()) / (1000 * 60 * 60 * 24);
    if (elapsed > decayDays) {
      // 衰减：保留 25%（记忆残留）
      approveCount = Math.floor(approveCount * 0.25);
      rejectCount = Math.floor(rejectCount * 0.25);
    }
  }

  return {
    approveCount, rejectCount,
    autoApprove: approveCount >= parseInt(row.auto_approve_threshold),
    autoReject: rejectCount >= parseInt(row.auto_reject_threshold),
  };
}

// ─── 第一层：Tirith 规则匹配 ────────────────────────────────────────────────

async function tirithMatch(call: ToolCall): Promise<ApprovalRule | null> {
  // 按 priority ASC 排序：critical(10) > high(30) > medium(60) > low(90)
  const rules = await query<ApprovalRule>(
    `SELECT * FROM approval_rules
     WHERE enabled = true AND (pattern_type = 'regex' OR pattern_type = 'keyword')
     ORDER BY priority ASC`
  );
  const argsStr = JSON.stringify(call.args);
  const toolName = call.name;
  for (const rule of rules) {
    try {
      if (rule.pattern_type === 'regex') {
        const re = new RegExp(rule.pattern, 'i');
        if (re.test(toolName) || re.test(argsStr)) return rule;
      } else if (rule.pattern_type === 'keyword') {
        const kw = rule.pattern.toLowerCase();
        if (toolName.toLowerCase().includes(kw) || argsStr.toLowerCase().includes(kw)) return rule;
      }
    } catch { /* invalid regex, skip */ }
  }
  return null;
}

// ─── 第二层：Pattern 历史匹配 ──────────────────────────────────────────────

async function patternMatch(toolName: string): Promise<{ level: 'low' | 'medium' | 'high'; count: number }> {
  const rows = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM approval_rule_hits
     WHERE tool_name = $1 AND hit_at > NOW() - INTERVAL '7 days'`,
    [toolName]
  );
  const count = parseInt(rows?.count || '0');
  if (count >= 21) return { level: 'high', count };
  if (count >= 6) return { level: 'medium', count };
  return { level: 'low', count };
}

// ─── 第四层：Smart LLM 裁决 ────────────────────────────────────────────────

async function smartLLMEval(call: ToolCall): Promise<DecisionLevel> {
  const argsStr = JSON.stringify(call.args, null, 2);
  const prompt = `你是一个安全审批助手。评估以下工具调用是否存在风险：

工具名：${call.name}
参数：${argsStr}

评估维度：
1. 数据安全：是否访问/修改敏感数据
2. 系统安全：是否影响系统稳定性
3. 权限安全：是否越权操作
4. 可逆性：操作是否可撤销

请以 JSON 格式回答：
{"decision": "auto_approve|auto_reject", "reason": "简短原因", "risk_score": 0-10}

注意：
- 高风险操作（删除大量数据、修改系统配置、批量发送消息等）：decision = "auto_reject"
- 低风险操作（只读查询、用户自己的数据等）：decision = "auto_approve"
- 明显危险操作（删除所有数据、执行恶意代码等）：decision = "auto_reject"`;

  try {
    const { agentChat } = await import('../llm/index.js');
    const response = await agentChat(
      { role: 'assistant', personality: '严谨精确' },
      [{ role: 'user', content: prompt }],
      { maxTokens: 256 }
    );
    const text = typeof response.content === 'string' ? response.content
      : response.content.map((b: ContentBlock) => b.type === 'text' ? (b as TextContent).text : '').join('');

    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        const decision = parsed.decision as DecisionLevel;
        const riskScore = typeof parsed.risk_score === 'number' ? parsed.risk_score : 5;
        if (decision === 'auto_reject' || riskScore >= 8) return 'auto_reject';
        return 'auto_approve';
      } catch {
        console.warn('[ApprovalRules] Smart LLM returned invalid JSON');
      }
    }
  } catch (e) {
    console.error('[ApprovalRules] Smart LLM eval failed:', e);
  }
  return 'auto_approve'; // LLM 失败时安全优先
}

// ─── 核心：四层漏斗检查 ────────────────────────────────────────────────────

/**
 * 核心：四层漏斗检查
 *
 * @param call 工具调用
 * @returns 决策结果（含商业文书标识）
 */
export async function checkDangerousLevel(call: ToolCall): Promise<DecisionResult> {
  const argsStr = JSON.stringify(call.args);

  // 商业文书生成 → 特殊处理（执行但标记 disclaimer）
  if (isCommercialDocument(argsStr)) {
    return { level: 'auto_approve', isCommercialDocument: true };
  }

  // 第一层：Tirith 静态规则
  const tirithRule = await tirithMatch(call);
  if (tirithRule) {
    console.log(`[ApprovalRules] Tirith hit: ${tirithRule.name} → ${tirithRule.action}`);
    await recordToolHit(call.name, argsStr, tirithRule.id);

    if (tirithRule.action === 'reject') return { level: 'auto_reject', isCommercialDocument: false };
    if (tirithRule.action === 'approve') {
      const evo = await getEvolutionStatus(tirithRule.id);
      if (evo?.autoApprove) {
        console.log(`[ApprovalRules] Evolution auto_approve: ${tirithRule.name} (${evo.approveCount}x)`);
        return { level: 'auto_approve', isCommercialDocument: false };
      }
      if (evo?.autoReject) {
        console.log(`[ApprovalRules] Evolution auto_reject: ${tirithRule.name} (${evo.rejectCount}x)`);
        return { level: 'auto_reject', isCommercialDocument: false };
      }
    }
    // require_approval → 继续第二层
  }

  // 第二层：Pattern 历史匹配（工具调用频率）
  const { level, count } = await patternMatch(call.name);
  console.log(`[ApprovalRules] Pattern: ${call.name} hit ${count} times in 7d → ${level}`);
  await recordToolHit(call.name, argsStr);

  // Pattern 高频 + 关键系统风险 → 直接拒绝
  if (level === 'high' && tirithRule?.risk_level === 'critical') {
    return { level: 'auto_reject', isCommercialDocument: false };
  }

  // Pattern 高频 + 危险操作类型 → 直接拒绝
  const dangerousTypes = ['delete', 'exec', 'send'];
  const isDangerousType = dangerousTypes.some(d => call.name.toLowerCase().includes(d));
  if (level === 'high' && isDangerousType) {
    return { level: 'auto_reject', isCommercialDocument: false };
  }

  // 第三层：用户行为自进化
  const matchingRule = await findMatchingRule(call.name, argsStr);
  if (matchingRule) {
    const evo = await getEvolutionStatus(matchingRule.id);
    if (evo) {
      if (evo.autoApprove) {
        console.log(`[ApprovalRules] Evolution auto_approve: ${matchingRule.name} (${evo.approveCount} approvals)`);
        return { level: 'auto_approve', isCommercialDocument: false };
      }
      if (evo.autoReject) {
        console.log(`[ApprovalRules] Evolution auto_reject: ${matchingRule.name} (${evo.rejectCount} rejections)`);
        return { level: 'auto_reject', isCommercialDocument: false };
      }
    }
  }

  // Pattern 低频 + 无特殊风险 → auto_approve
  if (level === 'low' && !tirithRule) {
    return { level: 'auto_approve', isCommercialDocument: false };
  }

  // 第四层：Smart LLM 裁决（兜底）
  const llmDecision = await smartLLMEval(call);
  return { level: llmDecision, isCommercialDocument: false };
}

// ─── 公共 API ───────────────────────────────────────────────────────────────

/**
 * 记录一次工具调用（用于 Pattern 统计）
 */
export async function recordToolHit(toolName: string, argsText: string, ruleId?: string): Promise<void> {
  await query(
    `INSERT INTO approval_rule_hits (id, rule_id, tool_name, args_text)
     VALUES ($1, $2, $3, $4)`,
    [crypto.randomUUID(), ruleId || null, toolName, argsText]
  );
}

export async function listRules(): Promise<ApprovalRule[]> {
  return query<ApprovalRule>('SELECT * FROM approval_rules ORDER BY created_at DESC');
}

export async function deleteRule(id: string): Promise<void> {
  await query('DELETE FROM approval_rules WHERE id = $1', [id]);
}

export async function isDangerousTool(toolName: string): Promise<boolean> {
  const rules = await query<ApprovalRule>(
    `SELECT * FROM approval_rules WHERE enabled = true ORDER BY priority ASC`
  );
  for (const rule of rules) {
    if (rule.pattern_type === 'keyword' && toolName.toLowerCase().includes(rule.pattern.toLowerCase())) {
      return true;
    }
    if (rule.pattern_type === 'regex') {
      try {
        if (new RegExp(rule.pattern, 'i').test(toolName)) return true;
      } catch {}
    }
  }
  return false;
}

/**
 * 记录用户对某类工具调用的实际批准/拒绝决定（用于自进化置信度）
 * 每次用户手动决定一个工具是否执行时调用
 */
export async function recordUserDecision(
  toolName: string,
  argsStr: string,
  decision: 'approved' | 'rejected'
): Promise<void> {
  const rule = await findMatchingRule(toolName, argsStr);
  if (!rule) return;
  const field = decision === 'approved' ? 'user_approve_count' : 'user_reject_count';
  await query(
    `UPDATE approval_rules SET ${field} = ${field} + 1, last_decided_at = NOW() WHERE id = $1`,
    [rule.id]
  );
}

// ─── 初始规则填充 ──────────────────────────────────────────────────────────

interface SeedRule {
  name: string; description: string;
  pattern: string; patternType: 'regex' | 'keyword';
  action: 'reject' | 'approve' | 'require_approval';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  autoApproveThreshold?: number; autoRejectThreshold?: number;
  priority: number;
}

/**
 * 完整规则清单（共16条）
 * priority: 越小越高，critical=10, high=30, medium=60, low=90
 * 优先级排序：系统目录删除(5) > 键盘记录(10) > 隐私截获(15) > 系统稳定性(20-40) > 商业文书(50)
 */
const DEFAULT_RULES: SeedRule[] = [
  // ── P0: 系统破坏（最高优先级）───────────────────────────────────────────
  {
    name: '系统目录文件删除',
    description: '禁止删除系统关键目录文件（/etc /usr /var /root），可能导致系统不可用',
    pattern: 'delete_file|delete_folder|rm |rmdir',
    patternType: 'keyword',
    action: 'reject', riskLevel: 'critical', priority: 5,
  },
  {
    name: '危险路径文件删除',
    description: '删除系统关键路径文件：/etc/ /usr/ /var/ /root/ /boot/',
    pattern: 'delete_file.*(/etc/|/usr/|/var/|/root/|/boot/)',
    patternType: 'regex',
    action: 'reject', riskLevel: 'critical', priority: 5,
  },
  {
    name: '危险系统命令执行',
    description: 'sudo/chmod 等高危系统命令，可能提权或破坏系统',
    pattern: 'execute_code.*(sudo|chmod 777|chown |mkfs|dd if=)',
    patternType: 'regex',
    action: 'reject', riskLevel: 'critical', priority: 10,
  },
  {
    name: '系统时间篡改',
    description: '修改系统时间可能影响证书校验、定时任务',
    pattern: 'date -s|settime|timedatectl|SetSystemTime|systime',
    patternType: 'keyword',
    action: 'reject', riskLevel: 'critical', priority: 15,
  },
  {
    name: '隐藏窗口/进程注入',
    description: '跨进程内存写入是典型恶意软件行为',
    pattern: 'CreateRemoteThread|SetWindowsHook|InjectDll|SetThreadContext|WriteProcessMemory',
    patternType: 'keyword',
    action: 'reject', riskLevel: 'critical', priority: 10,
  },
  {
    name: '资源耗尽操作',
    description: '无限循环或超大文件读取可能耗尽系统资源',
    pattern: '无限循环|infinite.?loop|while\\(true\\)|while\\(1\\)',
    patternType: 'regex',
    action: 'reject', riskLevel: 'critical', priority: 20,
  },

  // ── P1: 隐私截获 ────────────────────────────────────────────────────────
  {
    name: '键盘记录/剪贴板监控',
    description: '键盘记录器和剪贴板监控是典型间谍软件行为',
    pattern: 'keylog|keyboard.?log|clipboard.?monitor|keystroke|getKeystrokes',
    patternType: 'keyword',
    action: 'reject', riskLevel: 'critical', priority: 10,
  },
  {
    name: '短信/通话记录读取',
    description: '短信和通话记录涉及高度隐私，禁止未授权读取',
    pattern: 'sms|短信|call.?log|通话记录|read_sms|send_sms',
    patternType: 'keyword',
    action: 'reject', riskLevel: 'critical', priority: 15,
  },
  {
    name: '位置信息获取',
    description: 'GPS/位置数据属于高度敏感信息，禁止未授权访问',
    pattern: 'location|gps|地理位置|位置信息|getCurrentPosition',
    patternType: 'keyword',
    action: 'reject', riskLevel: 'critical', priority: 15,
  },
  {
    name: '摄像头/麦克风',
    description: '摄像头和麦克风是最高敏感级别硬件，禁止未授权访问',
    pattern: 'camera|mic|麦克风|摄像头|webcam|getUserMedia',
    patternType: 'keyword',
    action: 'reject', riskLevel: 'critical', priority: 15,
  },
  {
    name: '通讯录访问',
    description: '通讯录包含大量隐私信息，访问需明确授权',
    pattern: 'contacts|通讯录|phonebook|address_book|getContacts',
    patternType: 'keyword',
    action: 'require_approval', riskLevel: 'high', priority: 20,
    autoApproveThreshold: 2, autoRejectThreshold: 1,
  },

  // ── P2: 系统稳定性 ────────────────────────────────────────────────────
  {
    name: '批量文件删除',
    description: '单次删除多个文件可能是误操作或恶意行为',
    pattern: 'delete_file', patternType: 'keyword',
    action: 'require_approval', riskLevel: 'high', priority: 30,
    autoApproveThreshold: 3, autoRejectThreshold: 2,
  },
  {
    name: 'Shell/命令执行',
    description: '执行系统命令风险高，可能修改系统状态（需同时含高危修饰词）',
    pattern: 'execute_code|bash|sh -c|powershell',
    patternType: 'keyword',
    action: 'require_approval', riskLevel: 'high', priority: 30,
    autoApproveThreshold: 5, autoRejectThreshold: 2,
  },
  {
    name: '进程终止',
    description: '强制终止进程可能造成数据丢失（排除用户主动操作）',
    pattern: 'kill|terminate_process|stop_process|pkill',
    patternType: 'keyword',
    action: 'require_approval', riskLevel: 'high', priority: 40,
    autoApproveThreshold: 3, autoRejectThreshold: 2,
  },
  {
    name: '关闭防火墙/杀软',
    description: '关闭安全软件使系统暴露于威胁',
    pattern: 'disable.*firewall|stop.*antivirus|Defender.*disable|iptables.*stop|ufw disable',
    patternType: 'regex',
    action: 'require_approval', riskLevel: 'high', priority: 30,
    autoApproveThreshold: 5, autoRejectThreshold: 1,
  },
  {
    name: '大量文件外发',
    description: '短时间内外发大量数据可能是数据窃取',
    pattern: 'upload.*size.*50000000|send.*file.*large|exfil',
    patternType: 'regex',
    action: 'require_approval', riskLevel: 'high', priority: 35,
    autoApproveThreshold: 2, autoRejectThreshold: 1,
  },

  // ── P3: 商业文书（最低优先级）──────────────────────────────────────────
  {
    name: '商业文书生成',
    description: '合同/协议等商业文书仅供参考，不构成法律建议，输出附免责声明',
    pattern: '合同|协议|contract|agreement|nda|保密协议|条款|terms|授权书|委托书|采购合同|销售合同|租赁合同|MoU',
    patternType: 'keyword',
    action: 'approve', riskLevel: 'high', priority: 50,
  },
  {
    name: '金融/法律建议',
    description: '金融和法律建议可能造成重大损失，禁止自动生成',
    pattern: '投资建议|法律意见|financial.?advice|legal.?opinion|税务筹划|如何避税',
    patternType: 'keyword',
    action: 'reject', riskLevel: 'critical', priority: 25,
  },
];

export async function seedDefaultRules(): Promise<void> {
  const existing = await queryOne<{ cnt: string }>(`SELECT COUNT(*) as cnt FROM approval_rules`);
  if (existing && parseInt(existing.cnt) > 0) return;

  for (const r of DEFAULT_RULES) {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO approval_rules (id, name, description, pattern, pattern_type, action, risk_level,
        auto_approve_threshold, auto_reject_threshold, priority)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [id, r.name, r.description, r.pattern, r.patternType,
       r.action, r.riskLevel,
       r.autoApproveThreshold ?? 3, r.autoRejectThreshold ?? 3, r.priority]
    );
  }
  console.log(`[ApprovalRules] Seeded ${DEFAULT_RULES.length} default rules`);
}
