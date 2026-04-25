/**
 * 内存适配器 - 简单实现（可用于测试或无数据库场景）
 */

import type { LLMMessage } from '@colobot/types';
import type { MemoryStore } from '../runtime/types.js';

export interface InMemoryConfig {
  maxMessages?: number;
}

export class InMemoryStore implements MemoryStore {
  private sessions: Map<string, LLMMessage[]> = new Map();
  private maxMessages: number;

  constructor(config: InMemoryConfig = {}) {
    this.maxMessages = config.maxMessages || 100;
  }

  async append(
    agentId: string,
    sessionKey: string,
    role: string,
    content: unknown
  ): Promise<void> {
    const key = `${agentId}:${sessionKey}`;
    const messages = this.sessions.get(key) || [];

    messages.push({
      role: role as 'user' | 'assistant' | 'system',
      content: content as string,
    });

    // 限制消息数量
    if (messages.length > this.maxMessages) {
      messages.shift();
    }

    this.sessions.set(key, messages);
  }

  async getHistory(agentId: string, sessionKey: string): Promise<LLMMessage[]> {
    const key = `${agentId}:${sessionKey}`;
    return this.sessions.get(key) || [];
  }

  async clear(agentId: string, sessionKey: string): Promise<void> {
    const key = `${agentId}:${sessionKey}`;
    this.sessions.delete(key);
  }
}
