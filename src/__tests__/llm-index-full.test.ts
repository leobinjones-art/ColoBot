/**
 * LLM Index Full 测试
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
  getDefaultModel: vi.fn(() => 'gpt-4'),
  getApiEndpoint: vi.fn(() => 'https://api.openai.com/v1'),
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

describe('LLM Index Full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('chat with various options', () => {
    it('should call chat with temperature', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Response' } }] }),
      });

      const { chat } = await import('../llm/index.js');
      await chat([{ role: 'user', content: 'Hello' }], { temperature: 0.7 });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should call chat with maxTokens', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Response' } }] }),
      });

      const { chat } = await import('../llm/index.js');
      await chat([{ role: 'user', content: 'Hello' }], { maxTokens: 100 });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should call chat with model override', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Response' } }] }),
      });

      const { chat } = await import('../llm/index.js');
      await chat([{ role: 'user', content: 'Hello' }], { model: 'gpt-4-turbo' });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should call chat with system prompt override', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'Response' } }] }),
      });

      const { chat } = await import('../llm/index.js');
      await chat([{ role: 'user', content: 'Hello' }], { systemPromptOverride: 'You are helpful' });

      expect(mockFetch).toHaveBeenCalled();
    });
  });

  describe('getProviderName', () => {
    it('should return provider name', async () => {
      const { getProviderName } = await import('../llm/index.js');
      const provider = getProviderName();

      expect(['openai', 'anthropic', 'minimax']).toContain(provider);
    });
  });

  describe('setProvider', () => {
    it('should set provider', async () => {
      const { setProvider } = await import('../llm/index.js');
      setProvider('anthropic');

      // Should not throw
    });
  });
});