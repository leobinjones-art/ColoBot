/**
 * Skill 自进化 - 从对话中检测可复用模式
 */

import { query, queryOne } from '../memory/db.js';

interface DetectedPattern {
  pattern: string;
  toolSequence: string[];
  conversation: string;
  confidence: number;
}

interface SkillPattern {
  id: string;
  agent_id: string;
  agent_name: string;
  pattern: string;
  tool_sequence: string[];
  conversation: string;
  confidence: number;
  created_at: Date;
}

interface SkillProposal {
  id: string;
  agent_id: string;
  pattern_id: string | null;
  skill_name: string;
  pattern: string;
  tool_sequence: string[];
  markdown_content: string;
  status: string;
  confidence: number;
  created_at: Date;
}

/**
 * 从对话中检测可复用模式
 */
export async function detectPatterns(
  agentId: string,
  agentName: string,
  conversation: Array<{ role: string; content: string }>,
  toolSequence: string[]
): Promise<DetectedPattern | null> {
  // 条件：同一工具序列出现≥2次 或 单次高置信度
  if (toolSequence.length === 0) return null;

  const toolSeqStr = JSON.stringify(toolSequence);

  // 检查是否已有相似模式
  const existing = await query<SkillPattern>(
    `SELECT * FROM skill_patterns
     WHERE agent_id = $1 AND tool_sequence = $2`,
    [agentId, toolSeqStr]
  );

  if (existing.length > 0) {
    // 增加置信度
    const confidence = Math.min(1, existing[0].confidence + 0.1);
    await query(
      'UPDATE skill_patterns SET confidence = $1 WHERE id = $2',
      [confidence, existing[0].id]
    );
    return null;
  }

  const confidence = calculateConfidence(toolSequence);
  if (confidence < 0.5) return null;

  const pattern = `工具序列: ${toolSequence.join(' → ')}`;

  // 写入检测到的模式
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO skill_patterns (id, agent_id, agent_name, pattern, tool_sequence, conversation, confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, agentId, agentName, pattern, toolSeqStr, JSON.stringify(conversation.slice(-5)), confidence]
  );

  return { pattern, toolSequence, conversation: JSON.stringify(conversation.slice(-5)), confidence };
}

function calculateConfidence(toolSequence: string[]): number {
  if (toolSequence.length === 0) return 0;
  // 基础分：工具越多，置信度越高
  let score = Math.min(0.6, toolSequence.length * 0.15);
  // 重复工具增加置信度
  const unique = new Set(toolSequence).size;
  if (unique < toolSequence.length) score += 0.2;
  return Math.min(1, score);
}

/**
 * 生成 Skill Markdown 内容
 */
export function generateSkillMarkdown(name: string, pattern: string, toolSequence: string[]): string {
  return `# ${name}

## 触发词
\`${name.toLowerCase()}\`

## 描述
自动检测到的技能：从对话中学习生成。

## 执行工具序列
${toolSequence.map(t => `- ${t}`).join('\n')}

## 使用场景
${pattern}

## 使用方法
当用户消息包含 "${name.toLowerCase()}" 触发词时，自动执行此 Skill。
`;
}

/**
 * 写入待审批 Skill
 */
export async function writePendingSkill(
  agentId: string,
  name: string,
  markdownContent: string,
  toolSequence: string[]
): Promise<string> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO pending_skills (id, skill_name, markdown_content, trigger_words, agent_id, status)
     VALUES ($1, $2, $3, $4, $5, 'pending')`,
    [id, name, markdownContent, JSON.stringify([name.toLowerCase()]), agentId]
  );
  return id;
}

/**
 * 列出待审批的 Skill
 */
export async function listPendingSkills(): Promise<Array<{
  id: string;
  skill_name: string;
  markdown_content: string;
  trigger_words: string[];
  created_at: Date;
}>> {
  const rows = await query<{
    id: string;
    skill_name: string;
    markdown_content: string;
    trigger_words: string[];
    created_at: Date;
  }>('SELECT * FROM pending_skills WHERE status = $1 ORDER BY created_at DESC', ['pending']);

  return rows.map(r => ({
    ...r,
    trigger_words: typeof r.trigger_words === 'string' ? JSON.parse(r.trigger_words) : (r.trigger_words || []),
  }));
}

/**
 * 审批通过 - 激活 Skill
 */
export async function approveSkill(name: string, approver: string): Promise<void> {
  const pending = await queryOne<{
    id: string;
    skill_name: string;
    markdown_content: string;
    trigger_words: string[];
    agent_id: string | null;
  }>('SELECT * FROM pending_skills WHERE skill_name = $1 AND status = $2', [name, 'pending']);

  if (!pending) throw new Error(`Pending skill not found: ${name}`);

  // 写入 skills 表
  const skillId = crypto.randomUUID();
  await query(
    `INSERT INTO skills (id, name, description, markdown_content, trigger_words, enabled)
     VALUES ($1, $2, $3, $4, $5, true)
     ON CONFLICT (name) DO UPDATE SET
       markdown_content = $4, trigger_words = $5, updated_at = NOW()`,
    [skillId, name, '', pending.markdown_content, JSON.stringify(pending.trigger_words || [name.toLowerCase()])]
  );

  // 更新 pending 状态
  await query(
    'UPDATE pending_skills SET status = $1 WHERE id = $2',
    ['approved', pending.id]
  );
}

/**
 * 审批拒绝
 */
export async function rejectSkill(name: string, approver: string, reason?: string): Promise<void> {
  await query(
    'UPDATE pending_skills SET status = $1 WHERE skill_name = $2 AND status = $3',
    ['rejected', name, 'pending']
  );
}

/**
 * 主入口：从对话中自进化
 */
export async function evolveSkillFromConversation(
  agentId: string,
  agentName: string,
  conversation: Array<{ role: string; content: string }>,
  toolSequence: string[]
): Promise<void> {
  if (toolSequence.length < 2) return;

  const detected = await detectPatterns(agentId, agentName, conversation, toolSequence);
  if (!detected || detected.confidence < 0.7) return;

  const skillName = `AutoSkill_${Date.now()}`;
  const markdown = generateSkillMarkdown(skillName, detected.pattern, detected.toolSequence);

  await writePendingSkill(agentId, skillName, markdown, detected.toolSequence);
  console.log(`[SkillEvolution] Detected pattern with confidence ${detected.confidence}, pending approval: ${skillName}`);
}
