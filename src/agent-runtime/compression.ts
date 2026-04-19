/**
 * Context Compression - 超长会话自动压缩
 *
 * 策略：先截断（硬截断到 max_context_chars）再总结（LLM 生成摘要）
 * 触发条件：历史消息 token 超过 context_window * 0.8
 * 压缩后保留：系统提示 + 压缩摘要 + 最近 N 条消息
 */

import type { LLMMessage, ContentBlock, TextContent } from '../llm/index.js';
import { agentChat } from '../llm/index.js';

const CHARS_PER_TOKEN = 4;
const DEFAULT_MAX_CONTEXT_CHARS = 32_000; // ~8k tokens
const KEEP_RECENT_MESSAGES = 6; // 保留最近 6 条

/**
 * 估算文本 token 数（rough approximation）
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * 估算消息数组的总 token 数
 */
export function estimateMessagesTokens(messages: LLMMessage[]): number {
  return messages.reduce((sum, m) => {
    const content = typeof m.content === 'string' ? m.content
      : m.content.map(b => b.type === 'text' ? b.text : '').join(' ');
    return sum + estimateTokens(content) + 10; // +10 per message overhead
  }, 0);
}

/**
 * 对消息历史进行压缩
 * @param messages 原始消息数组
 * @param contextWindowTokens context_window 大小（token）
 * @param systemPrompt 系统提示（压缩时不丢弃）
 * @returns 压缩后的消息数组
 */
export async function compressMessages(
  messages: LLMMessage[],
  contextWindowTokens: number,
  systemPrompt?: string
): Promise<LLMMessage[]> {
  const threshold = Math.floor(contextWindowTokens * 0.8);
  const totalTokens = estimateMessagesTokens(messages);

  if (totalTokens <= threshold) {
    return messages; // 不需要压缩
  }

  console.log(`[Compression] ${totalTokens} tokens > ${threshold} threshold, compressing...`);

  // 找到 system 消息
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  // 保留最近的 N 条消息
  const recent = nonSystem.slice(-KEEP_RECENT_MESSAGES);
  const old = nonSystem.slice(0, -KEEP_RECENT_MESSAGES);

  if (old.length === 0) {
    // 已经是最近的消息了，无法进一步压缩，直接截断
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
    const summaryResponse = await agentChat(
      { role: 'assistant', personality: '简洁精确' },
      [
        { role: 'user', content: summaryPrompt }
      ],
      { maxTokens: 1024 }
    );

    const summaryText = typeof summaryResponse.content === 'string'
      ? summaryResponse.content
      : summaryResponse.content.map((b: ContentBlock) => b.type === 'text' ? (b as TextContent).text : '').join('');

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
    // 降级：直接截断
    return messages.slice(-KEEP_RECENT_MESSAGES * 2);
  }
}
