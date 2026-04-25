/**
 * Mock Provider - 测试用
 */

import type { LLMProvider, LLMResponse, LLMStreamChunk } from '../runtime/types.js';
import type { LLMMessage } from '@colobot/types';

export interface MockConfig {
  defaultModel?: string;
}

export class MockProvider implements LLMProvider {
  name = 'mock';
  private defaultModel: string;

  constructor(config: MockConfig = {}) {
    this.defaultModel = config.defaultModel || 'mock-model';
  }

  async chat(
    messages: LLMMessage[],
    _options?: { maxTokens?: number; temperature?: number }
  ): Promise<LLMResponse> {
    const lastMsg = messages[messages.length - 1];
    const text = this.getTextContent(lastMsg?.content);
    const systemText = this.getTextContent(messages.find(m => m.role === 'system')?.content);

    let content: string;

    if (systemText.includes('Skill')) {
      content = `[Mock Skill Response] 处理消息: "${text.slice(0, 40)}..." - Skill 执行成功`;
    } else if (text.includes('介绍')) {
      content = '我是 ColoBot，一个全模态 AI 助手。在 MOCK 模式下运行。';
    } else if (text.includes('记住')) {
      content = '好的，我已经记住了这个信息。';
    } else {
      content = `[Mock] 收到: "${text.slice(0, 30)}..." - 这是测试的 Mock 响应。`;
    }

    return { content };
  }

  async *chatStream(
    messages: LLMMessage[],
    _options?: { maxTokens?: number; temperature?: number }
  ): AsyncGenerator<LLMStreamChunk> {
    const result = await this.chat(messages);
    const text = typeof result.content === 'string' ? result.content : '';
    const chunkSize = Math.max(1, Math.ceil(text.length / 4));

    for (let i = 0; i < text.length; i += chunkSize) {
      yield { type: 'text', content: text.slice(i, i + chunkSize) };
    }
    yield { type: 'done' };
  }

  private getTextContent(content: string | unknown): string {
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      return content.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join(' ');
    }
    return '';
  }
}
