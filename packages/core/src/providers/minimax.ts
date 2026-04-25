/**
 * MiniMax Provider - Anthropic 兼容 API
 */

import type { LLMProvider, LLMResponse, LLMStreamChunk } from '../runtime/types.js';
import type { LLMMessage } from '@colobot/types';

export interface MiniMaxConfig {
  apiKey: string;
  defaultModel?: string;
  baseUrl?: string;
}

export class MiniMaxProvider implements LLMProvider {
  name = 'minimax';
  private apiKey: string;
  private defaultModel: string;
  private baseUrl: string;

  constructor(config: MiniMaxConfig) {
    this.apiKey = config.apiKey;
    this.defaultModel = config.defaultModel || 'MiniMax-Text-01';
    this.baseUrl = config.baseUrl || 'https://api.minimaxi.com/v1/messages';
  }

  async chat(
    messages: LLMMessage[],
    options?: { maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.defaultModel,
        messages: nonSystem,
        system: systemMsg?.content,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`MiniMax API error: ${res.status} ${err}`);
    }

    const data = await res.json() as { content: Array<{ type: string; text?: string }> };
    const textBlock = data.content.find(b => b.type === 'text');
    return { content: textBlock?.text ?? '' };
  }

  async *chatStream(
    messages: LLMMessage[],
    options?: { maxTokens?: number; temperature?: number }
  ): AsyncGenerator<LLMStreamChunk> {
    const systemMsg = messages.find(m => m.role === 'system');
    const nonSystem = messages.filter(m => m.role !== 'system');

    // MiniMax 流式使用不同端点
    const streamUrl = this.baseUrl.replace('/v1/messages', '/v1/text/chatcompletion_v2');

    const res = await fetch(streamUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.defaultModel,
        messages: nonSystem,
        system_instruction: systemMsg?.content,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxTokens ?? 4096,
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
              yield { type: 'text', content: text };
            }
          } catch { /* skip */ }
        }
      }
      yield { type: 'done' };
    } finally {
      try {
        reader.releaseLock();
      } catch { /* reader already released */ }
    }
  }
}
