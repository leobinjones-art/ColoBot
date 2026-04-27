/**
 * Skill 执行引擎 - 加载并执行 Skills
 */

import type { ToolContext, LLMMessage } from '@colobot/types';
import { query, queryOne } from '../memory/db.js';
import { parseToolCalls, executeToolCalls, formatToolResults } from '../tools/executor.js';
import { agentChat } from '../llm/index.js';

export interface Skill {
  id: string;
  name: string;
  description: string | null;
  markdown_content: string;
  trigger_words: string[];
  trigger_config: Record<string, unknown>;
  enabled: boolean;
}

interface SkillRow {
  id: string;
  name: string;
  description: string | null;
  markdown_content: string;
  trigger_words: string | string[];
  trigger_config: string | Record<string, unknown>;
  enabled: boolean;
}

/**
 * 列出所有启用的 Skills
 */
export async function listSkills(): Promise<Skill[]> {
  const rows = await query<SkillRow>('SELECT * FROM skills WHERE enabled = true ORDER BY name');
  return rows.map(parseSkillRow);
}

/**
 * 按名称获取 Skill
 */
export async function getSkillByName(name: string): Promise<Skill | null> {
  const row = await queryOne<SkillRow>('SELECT * FROM skills WHERE name = $1', [name]);
  return row ? parseSkillRow(row) : null;
}

/**
 * 检查消息是否触发某个 Skill
 */
export function matchesTrigger(skill: Skill, message: string): boolean {
  const lowerMsg = message.toLowerCase();
  return skill.trigger_words.some(word => lowerMsg.includes(word.toLowerCase()));
}

/**
 * 执行 Skill
 */
export async function executeSkill(
  skill: Skill,
  agentId: string,
  context: { sessionKey: string; userMessage: string }
): Promise<string> {
  const toolSequence = extractToolSequence(skill.markdown_content);

  if (toolSequence.length === 0) {
    const response = await agentChat(
      { personality: skill.markdown_content },
      [{ role: 'user', content: context.userMessage }],
      {}
    );
    const text = typeof response.content === 'string' ? response.content
      : response.content.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join(' ');
    return text;
  }

  const messages: LLMMessage[] = [
    { role: 'system', content: buildSkillSystemPrompt(skill) },
    { role: 'user', content: context.userMessage },
  ];

  let finalContent = '';
  const toolCtx: ToolContext = { agentId, sessionKey: context.sessionKey };

  for (let round = 0; round < 5; round++) {
    const response = await agentChat({ role: 'assistant', personality: skill.markdown_content }, messages, {});
    const rawContent = response.content;

    const rawText = typeof rawContent === 'string' ? rawContent
      : rawContent.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join(' ');

    const toolCalls = parseToolCalls(rawText);
    if (toolCalls.length === 0) {
      finalContent = rawText;
      break;
    }

    messages.push({ role: 'assistant', content: rawContent });

    const executed = await executeToolCalls(toolCalls, toolCtx);
    const toolResultText = formatToolResults(executed);

    messages.push({ role: 'user', content: toolResultText });
    finalContent = rawText;
  }

  return finalContent || '(无回复)';
}

function extractToolSequence(markdown: string): string[] {
  const match = markdown.match(/##\s*执行工具序列\n([\s\S]*?)(?:\n##|$)/i);
  if (!match) return [];

  const toolBlock = match[1];
  const tools: string[] = [];
  const lines = toolBlock.split('\n');

  for (const line of lines) {
    const trimmed = line.replace(/^[-*]\s*/, '').trim();
    if (trimmed && /^\w+$/.test(trimmed)) {
      tools.push(trimmed);
    }
  }

  return tools;
}

function buildSkillSystemPrompt(skill: Skill): string {
  const parts: string[] = [`Skill: ${skill.name}`];
  if (skill.description) parts.push(`描述: ${skill.description}`);
  parts.push('\n---\n' + skill.markdown_content);
  return parts.join('\n');
}

function parseSkillRow(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    markdown_content: row.markdown_content,
    trigger_words: typeof row.trigger_words === 'string' ? JSON.parse(row.trigger_words) : (row.trigger_words || []),
    trigger_config: typeof row.trigger_config === 'string' ? JSON.parse(row.trigger_config) : (row.trigger_config || {}),
    enabled: row.enabled,
  };
}
