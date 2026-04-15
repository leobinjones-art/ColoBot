/**
 * LLM 抽象层 - 支持 OpenAI / Anthropic / MiniMax / Mock
 */

// ─── Content Blocks (多模态) ──────────────────────────────────

export type TextContent = { type: 'text'; text: string };
export type ImageUrlContent = { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };
export type AudioContent = { type: 'input_audio'; input_audio: { data: string; format: string } };
export type ContentBlock = TextContent | ImageUrlContent | AudioContent;

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPromptOverride?: string;
  fallbackModelId?: string;
  stream?: boolean;
}

export interface LLMResponse {
  content: string | ContentBlock[];
  raw: unknown;
}

export interface LLMStreamChunk {
  content: string;
  done: boolean;
}

type ProviderType = 'openai' | 'anthropic' | 'minimax';

let currentProvider: ProviderType = 'openai';

export function setProvider(provider: ProviderType): void {
  currentProvider = provider;
}

export function getProviderName(): ProviderType {
  return currentProvider;
}

export async function chat(
  messages: LLMMessage[],
  options: LLMOptions = {}
): Promise<LLMResponse> {
  // Mock mode for local testing (no real API key needed)
  if (process.env.MOCK_LLM === 'true') {
    return mockChat(messages);
  }

  try {
    switch (currentProvider) {
      case 'openai':
        return await chatOpenAI(messages, options);
      case 'anthropic':
        return await chatAnthropic(messages, options);
      case 'minimax':
        return await chatMinimax(messages, options);
    }
  } catch (primaryError) {
    // Fallback model retry
    if (options.fallbackModelId) {
      console.warn(`[LLM] Primary model failed (${currentProvider}), trying fallback: ${options.fallbackModelId}`);
      const fallbackOptions = { ...options, model: options.fallbackModelId };
      delete fallbackOptions.fallbackModelId; // prevent infinite loop
      try {
        switch (currentProvider) {
          case 'openai':
            return await chatOpenAI(messages, fallbackOptions);
          case 'anthropic':
            return await chatAnthropic(messages, fallbackOptions);
          case 'minimax':
            return await chatMinimax(messages, fallbackOptions);
        }
      } catch (fallbackError) {
        console.error('[LLM] Fallback model also failed:', fallbackError);
        throw primaryError; // throw original error
      }
    }
    throw primaryError;
  }
  // unreachable
  throw new Error('No LLM provider configured');
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

/**
 * 流式聊天 - async generator
 */
export async function* chatStream(
  messages: LLMMessage[],
  options: LLMOptions = {}
): AsyncGenerator<LLMStreamChunk> {
  if (process.env.MOCK_LLM === 'true') {
    // Mock 模式模拟流式输出：分批 yield
    const result = mockChat(messages);
    const text = typeof result.content === 'string' ? result.content : result.content.map(b => b.type === 'text' ? b.text : '').join('');
    const chunkSize = Math.max(1, Math.ceil(text.length / 4));
    for (let i = 0; i < text.length; i += chunkSize) {
      yield { content: text.slice(i, i + chunkSize), done: false };
    }
    yield { content: '', done: true };
    return;
  }

  switch (currentProvider) {
    case 'openai':
      yield* chatStreamOpenAI(messages, options);
      break;
    case 'anthropic':
      yield* chatStreamAnthropic(messages, options);
      break;
    case 'minimax':
      yield* chatStreamMinimax(messages, options);
      break;
    default:
      throw new Error('No LLM provider configured');
  }
}

/**
 * 流式 agentChat - 带 system prompt
 */
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

// ─── Mock ───────────────────────────────────────────────────

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
    content = `[Mock] 收到: "${text.slice(0, 30)}..." - 这是 E2E 测试的 Mock 响应。`;
  }

  return { content, raw: { mock: true } };
}

// ─── OpenAI ────────────────────────────────────────────────

async function chatOpenAI(
  messages: LLMMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const model = options.model || 'gpt-4o';

  // OpenAI 支持多模态 content 数组，原样传递
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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

// ─── Anthropic ─────────────────────────────────────────────

async function chatAnthropic(
  messages: LLMMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = options.model || 'claude-sonnet-4-20250514';
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  // Anthropic 支持多模态 content 数组，原样传递
  const res = await fetch('https://api.anthropic.com/v1/messages', {
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

  const data = await res.json() as { content: Array<{ text: string } | { type: string; source: { media_type: string; data: string } }> };
  // Anthropic 返回 content 数组，转换为统一格式
  const textBlocks = data.content.filter(b => 'text' in b) as Array<{ text: string }>;
  return { content: textBlocks[0]?.text ?? '', raw: data };
}

// ─── MiniMax ───────────────────────────────────────────────

async function chatMinimax(
  messages: LLMMessage[],
  options: LLMOptions
): Promise<LLMResponse> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const model = options.model || 'MiniMax-Text-01';
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  const res = await fetch('https://api.minimaxi.com/v1/text/chatcompletion_v2', {
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
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`MiniMax API error: ${res.status} ${err}`);
  }

  const data = await res.json() as { choices: Array<{ messages: Array<{ text: string }> }> };
  return { content: data.choices[0]?.messages[0]?.text ?? '', raw: data };
}

// ─── OpenAI 流式 ───────────────────────────────────────────

async function* chatStreamOpenAI(
  messages: LLMMessage[],
  options: LLMOptions
): AsyncGenerator<LLMStreamChunk> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const model = options.model || 'gpt-4o';

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
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
          const chunk = JSON.parse(data) as {
            choices: Array<{ delta?: { content?: string } }>;
          };
          const text = chunk.choices[0]?.delta?.content;
          if (text) {
            yield { content: text, done: false };
          }
        } catch { /* skip malformed */ }
      }
    }
    yield { content: '', done: true };
  } finally {
    reader.releaseLock();
  }
}

// ─── Anthropic 流式 ─────────────────────────────────────────

async function* chatStreamAnthropic(
  messages: LLMMessage[],
  options: LLMOptions
): AsyncGenerator<LLMStreamChunk> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

  const model = options.model || 'claude-sonnet-4-20250514';
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
          const chunk = JSON.parse(data) as {
            type: string;
            delta?: { text?: string };
          };
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
    reader.releaseLock();
  }
}

// ─── MiniMax 流式 ─────────────────────────────────────────

async function* chatStreamMinimax(
  messages: LLMMessage[],
  options: LLMOptions
): AsyncGenerator<LLMStreamChunk> {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) throw new Error('MINIMAX_API_KEY not set');

  const model = options.model || 'MiniMax-Text-01';
  const systemMsg = messages.find(m => m.role === 'system');
  const nonSystem = messages.filter(m => m.role !== 'system');

  const res = await fetch('https://api.minimaxi.com/v1/text/chatcompletion_v2', {
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
          const chunk = JSON.parse(line) as {
            choices?: Array<{ delta?: { text?: string } }>;
          };
          const text = chunk.choices?.[0]?.delta?.text;
          if (text) {
            yield { content: text, done: false };
          }
        } catch { /* skip */ }
      }
    }
    yield { content: '', done: true };
  } finally {
    reader.releaseLock();
  }
}
