/**
 * Vector Memory 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('./db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock embeddings
vi.mock('./embeddings.js', () => ({
  embed: vi.fn(async () => ({ embedding: Array(1536).fill(0.1), model: 'test' })),
}));

import { query } from './db.js';
import { embed } from './embeddings.js';
import {
  addMemory,
  searchMemory,
  searchMemoryText,
  listMemory,
  hybridSearch,
} from '../memory/vector.js';

describe('Vector Memory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addMemory', () => {
    it('should add memory with embedding', async () => {
      await addMemory('agent-1', 'key-1', 'test content', { tag: 'test' });

      expect(embed).toHaveBeenCalledWith('test content');
      expect(query).toHaveBeenCalled();
    });

    it('should handle null embedding', async () => {
      vi.mocked(embed).mockResolvedValueOnce({ embedding: null, model: '' });

      await addMemory('agent-1', 'key-1', 'test');

      // Should not query if no embedding
      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('searchMemory', () => {
    it('should search by vector similarity', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        {
          id: 'mem-1',
          memory_key: 'key-1',
          memory_value: 'content',
          metadata: {},
          created_at: new Date(),
          similarity: 0.1,
        },
      ]);

      const results = await searchMemory('agent-1', 'query');

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('content');
    });

    it('should return empty for null embedding', async () => {
      vi.mocked(embed).mockResolvedValueOnce({ embedding: null, model: '' });

      const results = await searchMemory('agent-1', 'query');

      expect(results).toEqual([]);
    });

    it('should respect topK parameter', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      await searchMemory('agent-1', 'query', 10);

      const call = vi.mocked(query).mock.calls[0];
      expect(call[1]).toContain(10);
    });
  });

  describe('searchMemoryText', () => {
    it('should search by text match', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        {
          id: 'mem-1',
          memory_key: 'key-1',
          memory_value: 'test content',
          metadata: {},
          created_at: new Date(),
        },
      ]);

      const results = await searchMemoryText('agent-1', 'test');

      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBe(1);
    });

    it('should escape special characters', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      await searchMemoryText('agent-1', 'test%value');

      // Should not throw
    });
  });

  describe('listMemory', () => {
    it('should list all memories for agent', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { id: 'mem-1', memory_key: 'key-1', memory_value: 'content1', metadata: {}, created_at: new Date() },
        { id: 'mem-2', memory_key: 'key-2', memory_value: 'content2', metadata: {}, created_at: new Date() },
      ]);

      const results = await listMemory('agent-1');

      expect(results).toHaveLength(2);
    });
  });

  describe('hybridSearch', () => {
    it('should combine vector and text results', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce([
          { id: 'mem-1', memory_key: 'k1', memory_value: 'vector match', metadata: {}, created_at: new Date(), similarity: 0.1 },
        ])
        .mockResolvedValueOnce([
          { id: 'mem-2', memory_key: 'k2', memory_value: 'text match', metadata: {}, created_at: new Date() },
        ]);

      const results = await hybridSearch('agent-1', 'query');

      expect(results).toHaveLength(2);
    });

    it('should deduplicate results', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce([
          { id: 'mem-1', memory_key: 'k1', memory_value: 'content', metadata: {}, created_at: new Date(), similarity: 0.1 },
        ])
        .mockResolvedValueOnce([
          { id: 'mem-1', memory_key: 'k1', memory_value: 'content', metadata: {}, created_at: new Date() },
        ]);

      const results = await hybridSearch('agent-1', 'query');

      expect(results).toHaveLength(1);
    });

    it('should respect topK limit', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce([
          { id: 'mem-1', memory_key: 'k1', memory_value: 'c1', metadata: {}, created_at: new Date(), similarity: 0.1 },
          { id: 'mem-2', memory_key: 'k2', memory_value: 'c2', metadata: {}, created_at: new Date(), similarity: 0.2 },
        ])
        .mockResolvedValueOnce([]);

      const results = await hybridSearch('agent-1', 'query', 1);

      expect(results).toHaveLength(1);
    });
  });
});