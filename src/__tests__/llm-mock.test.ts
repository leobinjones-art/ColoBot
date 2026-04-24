/**
 * LLM Mock Mode 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock settings-cache to enable mock mode
vi.mock('../services/settings-cache.js', () => ({
  getMockLLM: vi.fn(() => true),
  getLlmProvider: vi.fn(() => 'openai'),
  getOpenAIApiKey: vi.fn(() => ''),
  getAnthropicApiKey: vi.fn(() => ''),
  getMinimaxApiKey: vi.fn(() => ''),
}));

vi.mock('../config/llm.js', () => ({
  getDefaultModel: vi.fn(() => 'gpt-4'),
  getApiEndpoint: vi.fn(() => 'https://api.openai.com'),
}));

vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
}));

describe('LLM Mock Mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('chat in mock mode', () => {
    it('should return mock response', async () => {
      const { chat } = await import('../llm/index.js');
      const response = await chat([{ role: 'user', content: 'Hello' }]);

      expect(response).toHaveProperty('content');
      expect(typeof response.content).toBe('string');
      expect(response.content).toContain('Mock');
    });

    it('should handle skill context', async () => {
      const { chat } = await import('../llm/index.js');
      const response = await chat([
        { role: 'system', content: 'You are a Skill agent.' },
        { role: 'user', content: 'Process this' },
      ]);

      expect(response.content).toContain('Skill');
    });

    it('should handle remember command', async () => {
      const { chat } = await import('../llm/index.js');
      const response = await chat([{ role: 'user', content: '请记住这个信息' }]);

      expect(response.content).toContain('记住');
    });
  });

  describe('agentChat in mock mode', () => {
    it('should build system prompt from soul', async () => {
      const { agentChat } = await import('../llm/index.js');
      const response = await agentChat(
        { personality: 'Friendly assistant', role: 'AI Assistant' },
        [{ role: 'user', content: 'Hello' }]
      );

      expect(response).toHaveProperty('content');
    });
  });

  describe('chatStream in mock mode', () => {
    it('should yield chunks', async () => {
      const { chatStream } = await import('../llm/index.js');
      const generator = chatStream([{ role: 'user', content: 'Hello' }]);

      const chunks: string[] = [];
      for await (const chunk of generator) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('agentChatStream in mock mode', () => {
    it('should yield chunks with system prompt', async () => {
      const { agentChatStream } = await import('../llm/index.js');
      const generator = agentChatStream(
        { role: 'Test Agent' },
        [{ role: 'user', content: 'Hello' }]
      );

      const chunks: string[] = [];
      for await (const chunk of generator) {
        if (chunk.content) {
          chunks.push(chunk.content);
        }
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });
});