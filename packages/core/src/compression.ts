/**
 * 上下文压缩
 */

import type { LLMMessage, ContentBlock } from '@colobot/types';
import type { LLMProvider } from './runtime/types.js';

const CHARS_PER_TOKEN = 4;
const KEEP_RECENT_MESSAGES = 6;

/**
 * 估算 token 数
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * 估算消息数组总 token 数
 */
export function estimateMessagesTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, m) => {
    const content = typeof m.content === 'string' ? m.content
      : m.content.map(b => b.type === 'text' ? b.text : '').join(' ');
    return sum + estimateTokens(content) + 10;
  }, 0);
}

/**
 * 压缩消息历史
 */
export async function compressMessages(
  messages: LLMMessage[],
  contextWindowTokens: number,
  llm?: LLMProvider,
  systemPrompt?: string
): Promise<LLMMessage[]> {
  const threshold = Math.floor(contextWindowTokens * 0.8);
  const totalTokens = estimateMessagesTokens(messages);

  if (totalTokens <= threshold) {
    return messages;
  }

  console.log(`[Compression] ${totalTokens} tokens > ${threshold} threshold, compressing...`);

  // 找到 system 消息
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  // 保留最近的 N 条消息
  const recent = nonSystem.slice(-KEEP_RECENT_MESSAGES);
  const old = nonSystem.slice(0, -KEEP_RECENT_MESSAGES);

  if (old.length === 0) {
    return messages.slice(-KEEP_RECENT_MESSAGES * 2);
  }

  // 如果没有 LLM，直接截断
  if (!llm) {
    console.log('[Compression] No LLM provided, using simple truncation');
    return messages.slice(-KEEP_RECENT_MESSAGES * 2);
  }

  // 用 LLM 总结旧消息
  const oldContent = old.map(m => {
    const content = typeof m.content === 'string'
      ? m.content
      : m.content.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join(' ');
    return `[${m.role}]: ${content}`;
  }).join('\n');

  const summaryPrompt = `请简洁地总结以下对话历史，保留所有关键信息、决策、工具调用结果。摘要要用中文：

${oldContent}

请生成一段简洁的摘要：`;

  try {
    const summaryResponse = await llm.chat(
      [{ role: 'user', content: summaryPrompt }],
      { maxTokens: 1024 }
    );

    const summaryText = typeof summaryResponse.content === 'string'
      ? summaryResponse.content
      : summaryResponse.content.map((b: ContentBlock) => b.type === 'text' ? b.text : '').join('');

    const compressed: LLMMessage[] = [];
    if (systemPrompt || systemMsg) {
      compressed.push({ role: 'system', content: systemPrompt || systemMsg!.content });
    }
    compressed.push({
      role: 'user',
      content: `[以上是之前对话的压缩摘要]\n${summaryText}`,
    });
    compressed.push(...recent);

    const newTokens = estimateMessagesTokens(compressed);
    console.log(`[Compression] Done: ${totalTokens} → ${newTokens} tokens (saved ${totalTokens - newTokens})`);
    return compressed;
  } catch (e) {
    console.error('[Compression] Failed, falling back to simple truncation:', e);
    return messages.slice(-KEEP_RECENT_MESSAGES * 2);
  }
}
