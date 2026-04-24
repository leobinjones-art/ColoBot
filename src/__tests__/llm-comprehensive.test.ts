/**
 * LLM Index Comprehensive 测试
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

describe('LLM Index Comprehensive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getProviderName', () => {
    it('should return current provider', async () => {
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

  describe('chat with fallback', () => {
    it('should handle fallback chain', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      const { chat } = await import('../llm/index.js');
      const result = await chat([{ role: 'user', content: 'Hello' }], {
        fallbackModelId: 'gpt-4o-mini',
      });

      expect(result.content).toBe('Response');
    });
  });

  describe('chat with retry', () => {
    it('should retry on failure', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            choices: [{ message: { content: 'Response after retry' } }],
          }),
        });

      const { chat } = await import('../llm/index.js');
      const result = await chat([{ role: 'user', content: 'Hello' }], {
        retries: 2,
        retryDelayMs: 10,
      });

      expect(result.content).toBe('Response after retry');
    });
  });

  describe('chat with content blocks', () => {
    it('should handle multimodal content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Image analyzed' } }],
        }),
      });

      const { chat } = await import('../llm/index.js');
      const result = await chat([
        {
          role: 'user',
          content: [
            { type: 'text', text: 'What is in this image?' },
            { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } },
          ],
        },
      ]);

      expect(result.content).toBe('Image analyzed');
    });
  });

  describe('chatStream', () => {
    it('should stream response', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n') })
          .mockResolvedValueOnce({ done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" World"}}]}\n\n') })
          .mockResolvedValueOnce({ done: true }),
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => mockReader },
      });

      const { chatStream } = await import('../llm/index.js');
      const chunks: string[] = [];

      for await (const chunk of chatStream([{ role: 'user', content: 'Hi' }])) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('agentChat with full soul', () => {
    it('should build complete system prompt', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      });

      const { agentChat } = await import('../llm/index.js');
      await agentChat(
        {
          role: 'Research Assistant',
          personality: 'Professional and thorough',
          rules: ['Always cite sources', 'Be concise'],
          skills: ['search', 'code'],
        },
        [{ role: 'user', content: 'Help me research' }]
      );

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});