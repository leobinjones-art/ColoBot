/**
 * Context Compression 模块测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock LLM
vi.mock('../llm/index.js', () => ({
  agentChat: vi.fn(async () => ({
    content: '这是对话历史的摘要：用户询问了天气，助手提供了天气预报。',
    finishReason: 'stop',
  })),
  ContentBlock: {},
  TextContent: {},
}));

import {
  estimateTokens,
  estimateMessagesTokens,
  compressMessages,
} from '../agent-runtime/compression.js';
import { agentChat } from '../llm/index.js';

describe('Context Compression', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      // 4 chars per token
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens('a')).toBe(1);
      expect(estimateTokens('abcd')).toBe(1);
      expect(estimateTokens('abcde')).toBe(2);
      expect(estimateTokens('hello world')).toBe(3);
    });

    it('should handle long text', () => {
      const longText = 'a'.repeat(1000);
      expect(estimateTokens(longText)).toBe(250);
    });
  });

  describe('estimateMessagesTokens', () => {
    it('should estimate total tokens for messages', () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there!' },
      ];

      const tokens = estimateMessagesTokens(messages);

      // Each message has +10 overhead
      // "You are helpful." = 4 tokens + 10 = 14
      // "Hello" = 2 tokens + 10 = 12
      // "Hi there!" = 3 tokens + 10 = 13
      // Total should be around 39
      expect(tokens).toBeGreaterThan(30);
      expect(tokens).toBeLessThan(50);
    });

    it('should handle multimodal content', () => {
      const messages = [
        {
          role: 'user' as const,
          content: [
            { type: 'text', text: 'What is this?' },
            { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } },
          ],
        },
      ];

      const tokens = estimateMessagesTokens(messages);

      // Should only count text content
      expect(tokens).toBeGreaterThan(10);
    });
  });

  describe('compressMessages', () => {
    beforeEach(() => {
      vi.mocked(agentChat).mockClear();
    });

    it('should not compress when under threshold', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful.' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi!' },
      ];

      const result = await compressMessages(messages, 100000);

      expect(result).toEqual(messages);
      expect(agentChat).not.toHaveBeenCalled();
    });

    it('should compress when over threshold', async () => {
      const longContent = 'x'.repeat(50000);
      const messages = [
        { role: 'system' as const, content: 'System prompt' },
        { role: 'user' as const, content: longContent },
        { role: 'assistant' as const, content: 'Response 1' },
        { role: 'user' as const, content: 'Question 2' },
        { role: 'assistant' as const, content: 'Response 2' },
        { role: 'user' as const, content: 'Question 3' },
        { role: 'assistant' as const, content: 'Response 3' },
        { role: 'user' as const, content: 'Question 4' },
        { role: 'assistant' as const, content: 'Response 4' },
        { role: 'user' as const, content: 'Question 5' },
        { role: 'assistant' as const, content: 'Response 5' },
        { role: 'user' as const, content: 'Latest question' },
        { role: 'assistant' as const, content: 'Latest response' },
      ];

      const result = await compressMessages(messages, 10000);

      // Should have called LLM for summary
      expect(agentChat).toHaveBeenCalled();

      // Should preserve system message
      expect(result.some(m => m.role === 'system')).toBe(true);

      // Should include summary
      expect(result.some(m => typeof m.content === 'string' && m.content.includes('压缩摘要'))).toBe(true);

      // Should keep recent messages
      expect(result.length).toBeLessThan(messages.length);
    });

    it('should preserve system prompt', async () => {
      const longContent = 'x'.repeat(50000);
      const messages = [
        { role: 'user' as const, content: longContent },
        { role: 'assistant' as const, content: 'Response 1' },
        { role: 'user' as const, content: 'Question 2' },
        { role: 'assistant' as const, content: 'Response 2' },
        { role: 'user' as const, content: 'Question 3' },
        { role: 'assistant' as const, content: 'Response 3' },
        { role: 'user' as const, content: 'Question 4' },
        { role: 'assistant' as const, content: 'Response 4' },
        { role: 'user' as const, content: 'Question 5' },
        { role: 'assistant' as const, content: 'Response 5' },
        { role: 'user' as const, content: 'Latest' },
        { role: 'assistant' as const, content: 'Latest response' },
      ];

      const result = await compressMessages(messages, 10000, 'Custom system prompt');

      // Should use provided system prompt
      const systemMsg = result.find(m => m.role === 'system');
      expect(systemMsg?.content).toBe('Custom system prompt');
    });

    it('should fallback to truncation on LLM error', async () => {
      vi.mocked(agentChat).mockRejectedValueOnce(new Error('LLM error'));

      const longContent = 'x'.repeat(50000);
      const messages = [
        { role: 'user' as const, content: longContent },
        { role: 'assistant' as const, content: 'Response 1' },
        { role: 'user' as const, content: 'Question 2' },
        { role: 'assistant' as const, content: 'Response 2' },
        { role: 'user' as const, content: 'Question 3' },
        { role: 'assistant' as const, content: 'Response 3' },
        { role: 'user' as const, content: 'Question 4' },
        { role: 'assistant' as const, content: 'Response 4' },
        { role: 'user' as const, content: 'Question 5' },
        { role: 'assistant' as const, content: 'Response 5' },
        { role: 'user' as const, content: 'Latest' },
        { role: 'assistant' as const, content: 'Latest response' },
      ];

      const result = await compressMessages(messages, 10000);

      // Should fallback to simple truncation
      expect(result.length).toBeLessThanOrEqual(12); // KEEP_RECENT_MESSAGES * 2
    });

    it('should handle empty messages', async () => {
      const result = await compressMessages([], 100000);

      expect(result).toEqual([]);
    });
  });
});
