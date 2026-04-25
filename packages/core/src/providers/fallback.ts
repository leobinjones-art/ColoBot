/**
 * Fallback Chain - 链式降级机制
 *
 * 支持：
 * - 链式 fallback：primary → fallback1 → fallback2 → ...
 * - 跨 provider 切换：openai:gpt-4o → anthropic:claude-sonnet
 * - 重试 + exponential backoff
 */

import type { LLMProvider, LLMResponse, LLMStreamChunk } from '../runtime/types.js';
import type { LLMMessage } from '@colobot/types';

export interface FallbackEntry {
  provider: 'openai' | 'anthropic' | 'minimax' | 'mock';
  modelId: string;
}

export interface FallbackConfig {
  /** 主 Provider */
  provider: LLMProvider;
  /** 主模型 ID */
  modelId: string;
  /** Fallback 链：provider:modelId 格式 */
  fallbackChain?: string[];
  /** 每个 model 的最大重试次数（默认 1） */
  retries?: number;
  /** 重试基础间隔（默认 1000ms） */
  retryDelayMs?: number;
}

/**
 * 解析 fallback 字符串
 * 支持格式：
 *   "anthropic:claude-sonnet-4-20250514"
 *   "claude-sonnet-4-20250514"  （保持当前 provider）
 */
export function parseFallbackString(
  fallback: string,
  defaultProvider: string
): FallbackEntry {
  if (fallback.includes(':')) {
    const [provider, modelId] = fallback.split(':');
    return { provider: provider as FallbackEntry['provider'], modelId };
  }
  return { provider: defaultProvider as FallbackEntry['provider'], modelId: fallback };
}

/**
 * 计算 backoff 时间
 */
function computeBackoff(attempt: number, baseDelayMs: number): number {
  return Math.min(baseDelayMs * Math.pow(2, attempt - 1), 30_000);
}

/**
 * 延迟
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 带 Fallback 的聊天
 */
export async function chatWithFallback(
  messages: LLMMessage[],
  providers: Map<string, LLMProvider>,
  config: FallbackConfig,
  options?: { maxTokens?: number; temperature?: number }
): Promise<LLMResponse> {
  const retries = config.retries ?? 1;
  const baseDelay = config.retryDelayMs ?? 1000;

  // 构建尝试链
  const chain: Array<{ provider: LLMProvider; modelId: string }> = [
    { provider: config.provider, modelId: config.modelId },
  ];

  // 添加 fallback
  if (config.fallbackChain) {
    for (const fb of config.fallbackChain) {
      const entry = parseFallbackString(fb, 'openai');
      const provider = providers.get(entry.provider);
      if (provider) {
        chain.push({ provider, modelId: entry.modelId });
      }
    }
  }

  let lastError: Error | null = null;

  for (const { provider, modelId } of chain) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      if (attempt > 1) {
        await sleep(computeBackoff(attempt - 1, baseDelay));
      }

      try {
        return await provider.chat(messages, { ...options, model: modelId } as any);
      } catch (e) {
        lastError = e as Error;
        console.warn(`[Fallback] ${modelId} attempt ${attempt} failed: ${lastError.message}`);
      }
    }
    console.warn(`[Fallback] All attempts exhausted for ${modelId}, trying next`);
  }

  throw lastError ?? new Error('All LLM models exhausted');
}

/**
 * 带 Fallback 的流式聊天
 */
export async function* chatStreamWithFallback(
  messages: LLMMessage[],
  providers: Map<string, LLMProvider>,
  config: FallbackConfig,
  options?: { maxTokens?: number; temperature?: number }
): AsyncGenerator<LLMStreamChunk> {
  // 构建尝试链
  const chain: Array<{ provider: LLMProvider; modelId: string }> = [
    { provider: config.provider, modelId: config.modelId },
  ];

  if (config.fallbackChain) {
    for (const fb of config.fallbackChain) {
      const entry = parseFallbackString(fb, 'openai');
      const provider = providers.get(entry.provider);
      if (provider) {
        chain.push({ provider, modelId: entry.modelId });
      }
    }
  }

  let firstError: Error | null = null;

  for (const { provider, modelId } of chain) {
    try {
      yield* provider.chatStream(messages, { ...options, model: modelId } as any);
      return;
    } catch (e) {
      if (!firstError) firstError = e as Error;
      console.warn(`[Fallback] Stream fallback: ${(e as Error).message}`);
    }
  }

  throw firstError;
}
