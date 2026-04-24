/**
 * Search Index 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock searxng
vi.mock('../search/searxng.js', () => ({
  search: vi.fn(async () => ({
    results: [
      { title: 'Result 1', url: 'https://example.com/1', snippet: 'Snippet 1' },
      { title: 'Result 2', url: 'https://example.com/2', snippet: 'Snippet 2' },
    ],
  })),
}));

describe('Search Index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should search and return results', async () => {
      const { search } = await import('../search/index.js');
      const result = await search('test query');

      expect(result).toBeDefined();
    });
  });
});