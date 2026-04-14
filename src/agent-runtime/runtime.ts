/**
 * Agent 运行时 - 消息路由 + LLM 循环
 */

import { agentRegistry, type Agent } from '../agents/registry.js';
import { sessionManager } from '../agents/session.js';
import { agentChat, type LLMMessage, type ContentBlock } from '../llm/index.js';
import { parseToolCalls, stripToolCalls, executeToolCalls, formatToolResults, isToolAllowed } from './tools/executor.js';
import { hybridSearch } from '../memory/vector.js';

export interface RunOptions {
  agentId: string;
  sessionKey: string;
  userMessage: string | ContentBlock[];
  maxRounds?: number;
}

export interface RunResult {
  response: string | ContentBlock[];
  toolCalls: string[];
  finished: boolean;
}

const DEFAULT_MAX_ROUNDS = 10;

export async function runAgent(opts: RunOptions): Promise<RunResult> {
  const { agentId, sessionKey, userMessage, maxRounds = DEFAULT_MAX_ROUNDS } = opts;

  const agent = await agentRegistry.get(agentId);
  if (!agent) throw new Error(`Agent not found: ${agentId}`);

  const soul = agentRegistry.parseSoul(agent.soul_content);

  // 获取历史消息
  const history = await sessionManager.getHistory(agentId, sessionKey);

  const messages: LLMMessage[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: userMessage },
  ];

  // 追加用户消息
  await sessionManager.appendMessage(agentId, sessionKey, 'user', userMessage);

  const toolCallNames: string[] = [];
  let finalContent: string | ContentBlock[] = '';

  for (let round = 0; round < maxRounds; round++) {
    const response = await agentChat(soul, messages, {
      temperature: agent.temperature,
      maxTokens: agent.max_tokens,
      model: agent.primary_model_id ?? undefined,
      systemPromptOverride: agent.system_prompt_override ?? undefined,
    });

    const rawContent = response.content;
    messages.push({ role: 'assistant', content: rawContent });

    // 解析工具调用时需要文本
    const rawText = typeof rawContent === 'string' ? rawContent
      : rawContent.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join(' ');

    const toolCalls = parseToolCalls(rawText);

    if (toolCalls.length === 0) {
      finalContent = rawContent;
      break;
    }

    toolCallNames.push(...toolCalls.map(c => c.name));

    // 执行工具调用
    const allowedCalls = toolCalls.filter(c => isToolAllowed('__parent__', c.name));
    const blockedCalls = toolCalls.filter(c => !isToolAllowed('__parent__', c.name));

    const executed = await executeToolCalls(allowedCalls);
    const toolResultText = formatToolResults(executed);

    const blockedText = blockedCalls.length > 0
      ? `\n[Blocked: ${blockedCalls.map(c => c.name).join(', ')} not allowed]`
      : '';

    messages.push({ role: 'user', content: `${toolResultText}${blockedText}` });
    finalContent = rawContent;
  }

  // 保存助手回复
  await sessionManager.appendMessage(agentId, sessionKey, 'assistant', finalContent);

  return {
    response: finalContent || '(无回复)',
    toolCalls: toolCallNames,
    finished: toolCallNames.length === 0 || toolCallNames.length >= maxRounds,
  };
}

export async function searchAgentMemory(agentId: string, query: string): Promise<string> {
  const results = await hybridSearch(agentId, query, 5);
  if (results.length === 0) return '未找到相关记忆。';
  return results.map(r => `[${r.similarity.toFixed(2)}] ${r.content}`).join('\n');
}
