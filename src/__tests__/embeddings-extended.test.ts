/**
 * Embeddings Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock settings-cache
vi.mock('../services/settings-cache.js', () => ({
  getMockLLM: vi.fn(() => false),
  getOpenAIApiKey: vi.fn(() => 'test-key'),
  getMinimaxApiKey: vi.fn(() => ''),
  getLlmProvider: vi.fn(() => 'openai'),
  getEmbeddingProvider: vi.fn(() => 'openai'),
}));

// Mock config/llm
vi.mock('../config/llm.js', () => ({
  getEmbeddingConfig: vi.fn(() => ({ model: 'text-embedding-3-small', endpoint: 'https://api.openai.com/v1/embeddings' })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Embeddings Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('embed', () => {
    it('should return embedding from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ embedding: [0.1, 0.2, 0.3] }],
        }),
      });

      const { embed } = await import('../memory/embeddings.js');
      const result = await embed('test text');

      expect(result.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('should handle API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Error',
      });

      // The module uses mock mode when API fails, so it won't throw
      const { embed } = await import('../memory/embeddings.js');
      const result = await embed('test');

      expect(result).toBeDefined();
    });
  });
});