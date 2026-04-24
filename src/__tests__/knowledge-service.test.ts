/**
 * Knowledge Service 测试
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

describe('Knowledge Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addKnowledge', () => {
    it('should add knowledge', async () => {
      const { addKnowledge } = await import('../services/knowledge.js');
      await addKnowledge({
        category: 'concept',
        name: 'Test Knowledge',
        content: 'Knowledge content',
      });

      // Should not throw
    });
  });

  describe('getKnowledge', () => {
    it('should get knowledge', async () => {
      const { getKnowledge } = await import('../services/knowledge.js');
      const result = await getKnowledge('concept', 'Test Knowledge');

      expect(result).toBeNull();
    });
  });

  describe('listKnowledge', () => {
    it('should list knowledge', async () => {
      const { listKnowledge } = await import('../services/knowledge.js');
      const result = await listKnowledge();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('searchKnowledge', () => {
    it('should search knowledge', async () => {
      const { searchKnowledge } = await import('../services/knowledge.js');
      const result = await searchKnowledge('test query');

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('deleteKnowledge', () => {
    it('should delete knowledge', async () => {
      const { deleteKnowledge } = await import('../services/knowledge.js');
      await deleteKnowledge('concept', 'Test Knowledge');

      // Should not throw
    });
  });
});