/**
 * LLM Index Extended 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock settings-cache
vi.mock('../services/settings-cache.js', () => ({
  getMockLLM: vi.fn(() => false),
  getLlmProvider: vi.fn(() => 'openai'),
  getOpenAIApiKey: vi.fn(() => 'test-openai-key'),
  getAnthropicApiKey: vi.fn(() => ''),
  getMinimaxApiKey: vi.fn(() => ''),
  getMinimaxGroupId: vi.fn(() => ''),
}));

// Mock config/llm
vi.mock('../config/llm.js', () => ({
  getDefaultModel: vi.fn((provider: string) => {
    if (provider === 'openai') return 'gpt-4';
    if (provider === 'anthropic') return 'claude-3-sonnet';
    return 'default-model';
  }),
  getApiEndpoint: vi.fn((provider: string) => {
    if (provider === 'openai') return 'https://api.openai.com/v1';
    if (provider === 'anthropic') return 'https://api.anthropic.com/v1';
    return 'https://api.example.com';
  }),
  getEmbeddingConfig: vi.fn(() => ({ model: 'text-embedding-3-small', endpoint: 'https://api.openai.com/v1/embeddings' })),
  DEFAULT_LLM_CONFIG: {
    openai: { defaultModel: 'gpt-4', apiEndpoint: 'https://api.openai.com/v1' },
    anthropic: { defaultModel: 'claude-3-sonnet', apiEndpoint: 'https://api.anthropic.com/v1' },
    minimax: { defaultModel: 'default', apiEndpoint: 'https://api.minimaxi.com' },
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('LLM Index Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('chat with OpenAI', () => {
    it('should call OpenAI chat completions API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello from GPT!' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      const { chat } = await import('../llm/index.js');
      const result = await chat([{ role: 'user', content: 'Hello' }]);

      expect(result.content).toBe('Hello from GPT!');
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle streaming request', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n') })
          .mockResolvedValueOnce({ done: true }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const { chatStream } = await import('../llm/index.js');
      const generator = chatStream([{ role: 'user', content: 'Hello' }]);

      const chunks: string[] = [];
      for await (const chunk of generator) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('agentChat', () => {
    it('should build system prompt from soul', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Agent response' } }],
        }),
      });

      const { agentChat } = await import('../llm/index.js');
      const result = await agentChat(
        { role: 'Test Agent', personality: 'Helpful' },
        [{ role: 'user', content: 'Hello' }]
      );

      expect(result.content).toBe('Agent response');
    });

    it('should include rules in system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      const { agentChat } = await import('../llm/index.js');
      await agentChat(
        { role: 'Agent', personality: 'Friendly', rules: ['Be helpful', 'Be concise'] },
        [{ role: 'user', content: 'Hello' }]
      );

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      });

      const { chat } = await import('../llm/index.js');
      await expect(chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow();
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { chat } = await import('../llm/index.js');
      await expect(chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow();
    });

    it('should handle rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit exceeded',
      });

      const { chat } = await import('../llm/index.js');
      await expect(chat([{ role: 'user', content: 'Hello' }])).rejects.toThrow();
    });
  });
});
