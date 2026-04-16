/**
 * 多层审批漏斗 - Tirith 规则引擎
 *
 * 三层漏斗：
 * 1. Tirith 规则 — 精确 regex/keyword 匹配，毫秒级，无 LLM
 * 2. Pattern 历史 — 过去 7 天同类工具调用频率，高频=高风险
 * 3. Smart LLM — 真正需要判断的操作，调用 LLM 裁决
 *
 * 决策结果：
 * - auto_reject    — 直接拒绝，无审批
 * - pending        — 需要人工审批（正常流程）
 * - auto_approve   — 直接放行，无审批
 */

import { query, queryOne } from '../memory/db.js';
import type { ToolCall } from './tools/executor.js';

export type DecisionLevel = 'auto_reject' | 'pending' | 'auto_approve';

interface ApprovalRule {
  id: string;
  name: string;
  description: string;
  pattern: string;
  pattern_type: 'regex' | 'keyword';
  action: 'reject' | 'approve' | 'require_approval';
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
}

interface PatternHit {
  tool_name: string;
  hit_count: number;
}

/**
 * 第一层：Tirith 规则匹配（精确，毫秒级）
 */
async function tirithMatch(call: ToolCall): Promise<ApprovalRule | null> {
  const rules = await query<ApprovalRule>(
    `SELECT * FROM approval_rules WHERE enabled = true AND (pattern_type = 'regex' OR pattern_type = 'keyword')`
  );

  const argsStr = JSON.stringify(call.args);
  const toolName = call.name;

  for (const rule of rules) {
    try {
      if (rule.pattern_type === 'regex') {
        const re = new RegExp(rule.pattern, 'i');
        if (re.test(toolName) || re.test(argsStr)) {
          return rule;
        }
      } else if (rule.pattern_type === 'keyword') {
        const kw = rule.pattern.toLowerCase();
        if (toolName.toLowerCase().includes(kw) || argsStr.toLowerCase().includes(kw)) {
          return rule;
        }
      }
    } catch {
      // invalid regex, skip
    }
  }
  return null;
}

/**
 * 第二层：Pattern 历史匹配（频率分析）
 *
 * 过去 7 天同类工具调用次数越多，风险越高：
 * - 0-5 次：正常
 * - 6-20 次：中等风险
 * - 21+ 次：高风险（需要更严格审批）
 */
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

/**
 * 第三层：Smart LLM 裁决
 *
 * 仅当一二层都无法确定时，对真正需要判断的操作调用 LLM 裁决。
 */
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
{"decision": "pending|auto_approve|auto_reject", "reason": "简短原因", "risk_score": 0-10}

注意：
- 高风险操作（删除大量数据、修改系统配置、批量发送消息等）：decision = "pending"
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
      : response.content.map((b: any) => b.type === 'text' ? b.text : '').join('');

    // 提取 JSON
    const match = text.match(/\{[\s\S]*?\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      const decision = parsed.decision as DecisionLevel;
      const riskScore = parsed.risk_score as number;

      // risk_score >= 8 → auto_reject，<= 3 → auto_approve，中间 → pending
      if (decision === 'auto_reject' || riskScore >= 8) return 'auto_reject';
      if (decision === 'auto_approve' || riskScore <= 3) return 'auto_approve';
      return 'pending';
    }
  } catch (e) {
    console.error('[ApprovalRules] Smart LLM eval failed:', e);
  }
  return 'pending';
}

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

/**
 * 获取所有规则
 */
export async function listRules(): Promise<ApprovalRule[]> {
  return query<ApprovalRule>('SELECT * FROM approval_rules ORDER BY created_at DESC');
}

/**
 * 添加规则
 */
export async function addRule(data: {
  name: string;
  description?: string;
  pattern: string;
  patternType?: 'regex' | 'keyword';
  action?: 'reject' | 'approve' | 'require_approval';
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
}): Promise<ApprovalRule> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO approval_rules (id, name, description, pattern, pattern_type, action, risk_level)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, data.name, data.description || '', data.pattern, data.patternType || 'keyword',
     data.action || 'require_approval', data.riskLevel || 'medium']
  );
  return queryOne<ApprovalRule>('SELECT * FROM approval_rules WHERE id = $1', [id]) as Promise<ApprovalRule>;
}

/**
 * 删除规则
 */
export async function deleteRule(id: string): Promise<void> {
  await query('DELETE FROM approval_rules WHERE id = $1', [id]);
}

/**
 * 核心：三层漏斗检查
 *
 * @param call 工具调用
 * @returns 决策结果
 */
export async function checkDangerousLevel(call: ToolCall): Promise<DecisionLevel> {
  // 第一层：Tirith 规则
  const tirithRule = await tirithMatch(call);
  if (tirithRule) {
    console.log(`[ApprovalRules] Tirith hit: ${tirithRule.name} → ${tirithRule.action}`);
    await recordToolHit(call.name, JSON.stringify(call.args), tirithRule.id);

    if (tirithRule.action === 'reject') return 'auto_reject';
    if (tirithRule.action === 'approve') return 'auto_approve';
    // require_approval → 继续到第二层
  }

  // 第二层：Pattern 历史匹配
  const { level, count } = await patternMatch(call.name);
  console.log(`[ApprovalRules] Pattern: ${call.name} hit ${count} times in 7d → ${level}`);
  await recordToolHit(call.name, JSON.stringify(call.args));

  // Pattern 高频 + 高风险级别规则 → 直接拒绝
  if (level === 'high' && tirithRule?.risk_level === 'critical') {
    return 'auto_reject';
  }

  // Pattern 高频 + action_type 危险 → pending
  const dangerousTypes = ['delete', 'exec', 'send'];
  const isDangerousType = dangerousTypes.some(d => call.name.toLowerCase().includes(d));
  if (level === 'high' && isDangerousType) {
    return 'pending';
  }

  // Pattern 中频 + 高风险规则 → pending
  if (level === 'medium' && tirithRule?.risk_level === 'high') {
    return 'pending';
  }

  // Pattern 低频 + 无特殊风险 → auto_approve
  if (level === 'low' && !tirithRule) {
    return 'auto_approve';
  }

  // 第三层：Smart LLM 裁决
  return smartLLMEval(call);
}

/**
 * 快速判断单个工具是否危险（用于工具注册检查）
 */
export async function isDangerousTool(toolName: string): Promise<boolean> {
  const rules = await query<ApprovalRule>(
    `SELECT * FROM approval_rules WHERE enabled = true AND pattern_type IN ('keyword', 'regex')`
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
