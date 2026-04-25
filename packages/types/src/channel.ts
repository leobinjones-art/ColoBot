/**
 * Channel 相关类型
 */

// 通道消息
export interface ChannelMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | ContentBlock[];
  metadata?: Record<string, unknown>;
}

// 通道适配器接口
export interface ChannelAdapter {
  name: string;
  send(message: ChannelMessage): Promise<void>;
  receive(): AsyncIterable<ChannelMessage>;
  close(): Promise<void>;
}

import type { ContentBlock } from './llm.js';
