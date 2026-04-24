/**
 * Embeddings 模块测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock settings-cache
vi.mock('../services/settings-cache.js', () => ({
  getMockLLM: vi.fn(() => true),
  getOpenAIApiKey: vi.fn(() => null),
  getMinimaxApiKey: vi.fn(() => null),
  getLlmProvider: vi.fn(() => 'openai'),
}));

// Mock config/llm
vi.mock('../config/llm.js', () => ({
  getEmbeddingConfig: vi.fn(() => ({ model: 'text-embedding-3-small', endpoint: 'https://api.openai.com/v1/embeddings' })),
}));

import { embed } from '../memory/embeddings.js';

describe('Embeddings', () => {
  describe('embed (mock mode)', () => {
    it('should return embedding vector in mock mode', async () => {
      const result = await embed('test text');

      expect(result.embedding).not.toBeNull();
      expect(result.embedding).toHaveLength(1536);
      expect(result.model).toBe('mock-embedding');
    });

    it('should return deterministic embedding based on text length', async () => {
      const result1 = await embed('hello');
      const result2 = await embed('hello');
      const result3 = await embed('hello world');

      // Same text should produce same embedding
      expect(result1.embedding).toEqual(result2.embedding);
      // Different text should produce different embedding
      expect(result1.embedding).not.toEqual(result3.embedding);
    });

    it('should normalize embedding values', async () => {
      const result = await embed('test normalization');

      // Values should be small (sin * 0.1)
      for (const val of result.embedding!) {
        expect(Math.abs(val)).toBeLessThanOrEqual(0.1);
      }
    });

    it('should handle empty string', async () => {
      const result = await embed('');

      expect(result.embedding).not.toBeNull();
      expect(result.embedding).toHaveLength(1536);
    });

    it('should handle long text', async () => {
      const longText = 'a'.repeat(10000);
      const result = await embed(longText);

      expect(result.embedding).not.toBeNull();
      expect(result.embedding).toHaveLength(1536);
    });
  });
});
