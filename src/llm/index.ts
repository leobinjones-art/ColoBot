/**
 * LLM 抽象层 - 支持 OpenAI / Anthropic / MiniMax / Mock
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  model?: string;
  systemPromptOverride?: string;
}

export interface LLMResponse {
  content: string;
  raw: unknown;
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

  switch (currentProvider) {
    case 'openai':
      return chatOpenAI(messages, options);
    case 'anthropic':
      return chatAnthropic(messages, options);
    case 'minimax':
      return chatMinimax(messages, options);
  }
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

function mockChat(messages: LLMMessage[]): LLMResponse {
  const lastMsg = messages[messages.length - 1]?.content || '';
  const role = messages.find(m => m.role === 'system')?.content || '';
  let content: string;

  if (role.includes('Skill')) {
    content = `[Mock Skill Response] 处理消息: "${lastMsg.slice(0, 40)}..." - Skill 执行成功`;
  } else if (lastMsg.includes('介绍')) {
    content = '我是 ColoBot，一个多模态 AI 助手。在 MOCK_LLM 模式下运行。';
  } else if (lastMsg.includes('记住')) {
    content = '好的，我已经记住了这个信息。';
  } else {
    content = `[Mock] 收到: "${lastMsg.slice(0, 30)}..." - 这是 E2E 测试的 Mock 响应。`;
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

  const data = await res.json() as { choices: Array<{ message: { content: string } }> };
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

  const data = await res.json() as { content: Array<{ text: string }> };
  return { content: data.content[0]?.text ?? '', raw: data };
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

  const res = await fetch('https://api.minimax.chat/v1/text/chatcompletion_v2', {
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
