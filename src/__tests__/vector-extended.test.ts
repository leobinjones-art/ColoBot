/**
 * Vector Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock embeddings
vi.mock('../memory/embeddings.js', () => ({
  embed: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], model: 'mock' })),
}));

describe('Vector Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addMemory', () => {
    it('should add memory', async () => {
      const { addMemory } = await import('../memory/vector.js');
      await addMemory('agent-1', 'test-key', 'Memory content');

      // Should not throw
    });
  });

  describe('searchMemory', () => {
    it('should search memory', async () => {
      const { searchMemory } = await import('../memory/vector.js');
      const result = await searchMemory('agent-1', 'test query');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('listMemory', () => {
    it('should list memory', async () => {
      const { listMemory } = await import('../memory/vector.js');
      const result = await listMemory('agent-1');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('searchMemoryText', () => {
    it('should search memory by text', async () => {
      const { searchMemoryText } = await import('../memory/vector.js');
      const result = await searchMemoryText('agent-1', 'test query');

      expect(Array.isArray(result)).toBe(true);
    });
  });
});