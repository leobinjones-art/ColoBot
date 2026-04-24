/**
 * LLM Index More 测试
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

describe('LLM Index More', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('chat', () => {
    it('should call OpenAI API with system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

      const { chat } = await import('../llm/index.js');
      const result = await chat([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ]);

      expect(result.content).toBe('Response');
    });

    it('should handle temperature parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      const { chat } = await import('../llm/index.js');
      await chat([{ role: 'user', content: 'Hello' }], { temperature: 0.5 });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle max_tokens parameter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      const { chat } = await import('../llm/index.js');
      await chat([{ role: 'user', content: 'Hello' }], { max_tokens: 100 });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('agentChat', () => {
    it('should build system prompt with skills', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      const { agentChat } = await import('../llm/index.js');
      await agentChat(
        {
          role: 'Agent',
          personality: 'Helpful',
          skills: ['search', 'code'],
        },
        [{ role: 'user', content: 'Hello' }]
      );

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle empty soul', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      const { agentChat } = await import('../llm/index.js');
      await agentChat({}, [{ role: 'user', content: 'Hello' }]);

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});