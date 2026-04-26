/**
 * LLM 抽象层 - 支持 OpenAI / Anthropic / MiniMax / Mock
 *
 * Fallback 特性：
 * - 链式 fallback：primary → fallback1 → fallback2 → ...
 * - 跨 provider 切换：openai:gpt-4o → anthropic:claude-sonnet
 * - 重试 + exponential backoff
 */

import type { LLMMessage, ContentBlock } from '@colobot/types';
import {
  getMockLLM,
  getLlmProvider,
  getOpenAIApiKey,
  getAnthropicApiKey,
  getMinimaxApiKey,
  type ProviderType,
} from '../config/llm-settings.js';

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPromptOverride?: string;
  fallbackModelId?: string;
  stream?: boolean;
  retries?: number;
  retryDelayMs?: number;
}

export interface LLMResponse {
  content: string | ContentBlock[];
  raw: unknown;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

// ─── 模型配置 ───────────────────────────────────────────────────

const DEFAULT_MODELS: Record<ProviderType, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-20250514',
  minimax: 'MiniMax-M2.7-highspeed',
};

const API_ENDPOINTS: Record<ProviderType, string> = {
  openai: 'https://api.openai.com/v1/chat/completions',
  anthropic: 'https://api.anthropic.com/v1/messages',
  minimax: 'https://api.minimaxi.com/anthropic/v1/messages',
};

function getDefaultModel(provider: ProviderType): string {
  return process.env[`${provider.toUpperCase()}_DEFAULT_MODEL`] || DEFAULT_MODELS[provider];
}

function getApiEndpoint(provider: ProviderType): string {
  return process.env[`${provider.toUpperCase()}_API_ENDPOINT`] || API_ENDPOINTS[provider];
}

// ─── Fallback Chain ──────────────────────────────────────────────

interface FallbackEntry {
  provider: ProviderType;
  modelId: string;
}

function parseFallbackChain(fallbackModelId: string, currentProvider: ProviderType): FallbackEntry[] {
  const entries: FallbackEntry[] = [];
  const parts = fallbackModelId.split(',').map(s => s.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes(':')) {
      const [provider, modelId] = part.split(':');
      if (isProvider(provider as ProviderType)) {
        entries.push({ provider: provider as ProviderType, modelId });
      }
    } else {
      entries.push({ provider: currentProvider, modelId: part });
    }
  }

  return entries;
}

function isProvider(s: string): s is ProviderType {
  return ['openai', 'anthropic', 'minimax'].includes(s);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function computeBackoff(attempt: number, baseDelayMs: number): number {
  return Math.min(baseDelayMs * Math.pow(2, attempt - 1), 30_000);
}

// ─── 执行单个 provider 的 chat ───────────────────────────────────

async function executeChat(
  provider: ProviderType,
  modelId: string,
  messages: LLMMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  switch (provider) {
    case 'openai':
      return chatOpenAI(messages, { ...options, model: modelId });
    case 'anthropic':
      return chatAnthropic(messages, { ...options, model: modelId });
    case 'minimax':
      return chatMinimax(messages, { ...options, model: modelId });
  }
}

async function* executeChatStream(
  provider: ProviderType,
  modelId: string,
  messages: LLMMessage[],
  options: LLMOptions
): AsyncGenerator<LLMStreamChunk> {
  switch (provider) {
    case 'openai':
      yield* chatStreamOpenAI(messages, { ...options, model: modelId });
      break;
    case 'anthropic':
      yield* chatStreamAnthropic(messages, { ...options, model: modelId });
      break;
    case 'minimax':
      yield* chatStreamMinimax(messages, { ...options, model: modelId });
      break;
  }
}

// ─── 主入口 ───────────────────────────────────────────────────────

export async function chat(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  if (getMockLLM()) {
    return mockChat(messages);
  }

  const chain: FallbackEntry[] = [];
  if (options.model) {
    chain.push({ provider: getLlmProvider(), modelId: options.model });
  }
  if (options.fallbackModelId) {
    chain.push(...parseFallbackChain(options.fallbackModelId, getLlmProvider()));
  }

  if (chain.length === 0) {
    chain.push({ provider: getLlmProvider(), modelId: getDefaultModel(getLlmProvider()) });
  }

  const retries = options.retries ?? 1;
  const baseDelay = options.retryDelayMs ?? 1000;
  let lastError: Error | null = null;

  for (const { provider, modelId } of chain) {
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      if (attempt > 1) {
        await sleep(computeBackoff(attempt - 1, baseDelay));
      }
      try {
        return await executeChat(provider, modelId, messages, options);
      } catch (e) {
        lastError = e as Error;
        console.warn(`[LLM] ${provider}/${modelId} attempt ${attempt} failed: ${lastError.message}`);
      }
    }
    console.warn(`[LLM] All attempts exhausted for ${provider}/${modelId}, trying next fallback`);
  }

  throw lastError ?? new Error('All LLM models exhausted');
}

export async function agentChat(
  soul: { personality?: string; role?: string },
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  const systemPrompt = buildSystemPrompt(soul, options.systemPromptOverride);
  const fullMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];
  return chat(fullMessages, options);
}

export async function* chatStream(
  messages: LLMMessage[],
  options: LLMOptions = {}
): AsyncGenerator<LLMStreamChunk> {
  if (getMockLLM()) {
    yield* mockChatStream(messages);
    return;
  }

  const chain: FallbackEntry[] = [];
  if (options.model) {
    chain.push({ provider: getLlmProvider(), modelId: options.model });
  }
  if (options.fallbackModelId) {
    chain.push(...parseFallbackChain(options.fallbackModelId, getLlmProvider()));
  }
  if (chain.length === 0) {
    chain.push({ provider: getLlmProvider(), modelId: getDefaultModel(getLlmProvider()) });
  }

  let firstError: Error | null = null;

  for (const { provider, modelId } of chain) {
    try {
      yield* executeChatStream(provider, modelId, messages, options);
      return;
    } catch (e) {
      if (!firstError) firstError = e as Error;
      console.warn(`[LLM] Stream fallback to ${provider}/${modelId}: ${(e as Error).message}`);
    }
  }

  throw firstError;
}

export async function* agentChatStream(
  soul: { personality?: string; role?: string },
  messages: LLMMessage[],
  options: LLMOptions = {}
): AsyncGenerator<LLMStreamChunk> {
  const systemPrompt = buildSystemPrompt(soul, options.systemPromptOverride);
  const fullMessages: LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...messages,
  ];
  yield* chatStream(fullMessages, { ...options, stream: true });
}

function buildSystemPrompt(
  soul: { personality?: string; role?: string },
  override?: string
): string {
  if (override) return override;
  const parts: string[] = [];
  if (soul.role) parts.push(`你是 ${soul.role}。`);
  if (soul.personality) parts.push(`\n## 性格\n${soul.personality}`);
  return parts.join('\n\n');
}

// ─── Mock ─────────────────────────────────────────────────────────

function getTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;
  return content.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join(' ');
}

function mockChat(messages: LLMMessage[]): LLMResponse {
  const lastMsg = messages[messages.length - 1]?.content || '';
  const text = getTextContent(lastMsg);
  const role = getTextContent(messages.find(m => m.role === 'system')?.content || '');
  let content: string;

  if (role.includes('Skill')) {
    content = `[Mock Skill Response] 处理消息: "${text.slice(0, 40)}..." - Skill 执行成功`;
  } else if (text.includes('介绍')) {
    content = '我是 ColoBot，一个全模态 AI 助手，支持文本/图片/音频/视频。在 MOCK_LLM 模式下运行。';
  } else if (text.includes('记住')) {
    content = '好的，我已经记住了这个信息。';
  } else {
    content = `[Mock] 收到: "${text.slice(0, 30)}..." - 这是测试的 Mock 响应。`;
  }

  return { content, raw: { mock: true } };
}

async function* mockChatStream(messages: LLMMessage[]): AsyncGenerator<LLMStreamChunk> {
  const result = mockChat(messages);
  const text = typeof result.content === 'string' ? result.content : '';
  const chunkSize = Math.max(1, Math.ceil(text.length / 4));
  for (let i = 0; i < text.length; i += chunkSize) {
    yield { content: text.slice(i, i + chunkSize), done: false };
  }
  yield { content: '', done: true };
}

// ─── OpenAI ───────────────────────────────────────────────────────

async function chatOpenAI(messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const model = options.model || getDefaultModel('openai');
  const endpoint = getApiEndpoint('openai');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  const data = await res.json() as { choices: Array<{ message: { content: string | ContentBlock[] } }> };
  return { content: data.choices[0]?.message?.content ?? '', raw: data };
}

async function* chatStreamOpenAI(messages: LLMMessage[], options: LLMOptions): AsyncGenerator<LLMStreamChunk> {
  const apiKey = getOpenAIApiKey();
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const model = options.model || getDefaultModel('openai');
  const endpoint = getApiEndpoint('openai');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${err}`);
  }

  if (!res.body) throw new Error('No response body for streaming');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        if (data === '[DONE]') {
          yield { content: '', done: true };
          return;
        }
        try {
          const chunk = JSON.parse(data) as { choices: Array<{ delta?: { content?: string } }> };
          const text = chunk.choices[0]?.delta?.content;
          if (text) yield { content: text, done: false };
        } catch { /* skip */ }
      }
    }
    yield { content: '', done: true };
  } finally {
    try { reader.releaseLock(); } catch { /* */ }
  }
}

// ─── Anthropic ─────────────────────────────────────────────────────

async function chatAnthropic(messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = options.model || getDefaultModel('anthropic');
  const endpoint = getApiEndpoint('anthropic');
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: nonSystem,
      system: systemMsg?.content,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }

  const data = await res.json() as { content: Array<{ text: string } | { type: string }> };
  const textBlocks = data.content.filter(b => 'text' in b) as Array<{ text: string }>;
  return { content: textBlocks[0]?.text ?? '', raw: data };
}

async function* chatStreamAnthropic(messages: LLMMessage[], options: LLMOptions): AsyncGenerator<LLMStreamChunk> {
  const apiKey = getAnthropicApiKey();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = options.model || getDefaultModel('anthropic');
  const endpoint = getApiEndpoint('anthropic');
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: nonSystem,
      system: systemMsg?.content,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error: ${res.status} ${err}`);
  }

  if (!res.body) throw new Error('No response body for streaming');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6);
        try {
          const chunk = JSON.parse(data) as { type: string; delta?: { text?: string } };
          if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
            yield { content: chunk.delta.text, done: false };
          } else if (chunk.type === 'message_stop') {
            yield { content: '', done: true };
            return;
          }
        } catch { /* skip */ }
      }
    }
    yield { content: '', done: true };
  } finally {
    try { reader.releaseLock(); } catch { /* */ }
  }
}

// ─── MiniMax ───────────────────────────────────────────────────────

async function chatMinimax(messages: LLMMessage[], options: LLMOptions): Promise<LLMResponse> {
  const apiKey = getMinimaxApiKey();
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const model = options.model || getDefaultModel('minimax');
  const endpoint = getApiEndpoint('minimax');
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      messages: nonSystem,
      system: systemMsg?.content,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API error: ${res.status} ${err}`);
  }

  const data = await res.json() as { content: Array<{ type: string; text?: string }> };
  const textBlock = data.content.find(b => b.type === 'text');
  return { content: textBlock?.text ?? '', raw: data };
}

async function* chatStreamMinimax(messages: LLMMessage[], options: LLMOptions): AsyncGenerator<LLMStreamChunk> {
  const apiKey = getMinimaxApiKey();
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const model = options.model || getDefaultModel('minimax');
  const endpoint = process.env.MINIMAX_STREAM_ENDPOINT || 'https://api.minimaxi.com/v1/text/chatcompletion_v2';
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: nonSystem,
      system_instruction: systemMsg?.content,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
      stream: true,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API error: ${res.status} ${err}`);
  }

  if (!res.body) throw new Error('No response body for streaming');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim() || line.startsWith('data:')) continue;
        try {
          const chunk = JSON.parse(line) as { choices?: Array<{ delta?: { text?: string } }> };
          const text = chunk.choices?.[0]?.delta?.text;
          if (text) yield { content: text, done: false };
        } catch { /* skip */ }
      }
    }
    yield { content: '', done: true };
  } finally {
    try { reader.releaseLock(); } catch { /* */ }
  }
}

// Re-export provider type
export { type ProviderType } from '../config/llm-settings.js';
