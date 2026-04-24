/**
 * Knowledge Service 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

import { query, queryOne } from '../memory/db.js';
import {
  addKnowledge,
  getKnowledge,
  listKnowledge,
  searchKnowledge,
  deleteKnowledge,
} from '../services/knowledge.js';

describe('Knowledge Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addKnowledge', () => {
    it('should add a knowledge entry', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'test-id',
        category: 'concept',
        name: 'TestConcept',
        content: 'Test content',
        variables: [],
        related: [],
        metadata: {},
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await addKnowledge({
        category: 'concept',
        name: 'TestConcept',
        content: 'Test content',
      });

      expect(result.name).toBe('TestConcept');
      expect(result.category).toBe('concept');
    });

    it('should handle variables and related', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'test-id',
        category: 'template',
        name: 'EmailTemplate',
        content: 'Hello {{name}}',
        variables: ['name'],
        related: ['Greeting'],
        metadata: { type: 'email' },
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await addKnowledge({
        category: 'template',
        name: 'EmailTemplate',
        content: 'Hello {{name}}',
        variables: ['name'],
        related: ['Greeting'],
        metadata: { type: 'email' },
      });

      expect(result.variables).toEqual(['name']);
      expect(result.related).toEqual(['Greeting']);
    });
  });

  describe('getKnowledge', () => {
    it('should return knowledge entry', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'test-id',
        category: 'rule',
        name: 'SecurityRule',
        content: 'Always validate input',
        variables: '[]',
        related: '[]',
        metadata: '{}',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await getKnowledge('rule', 'SecurityRule');

      expect(result).not.toBeNull();
      expect(result?.name).toBe('SecurityRule');
    });

    it('should return null if not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const result = await getKnowledge('concept', 'NonExistent');

      expect(result).toBeNull();
    });

    it('should parse JSON fields', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'test-id',
        category: 'concept',
        name: 'Test',
        content: 'Content',
        variables: '["var1", "var2"]',
        related: '["rel1"]',
        metadata: '{"key": "value"}',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await getKnowledge('concept', 'Test');

      expect(result?.variables).toEqual(['var1', 'var2']);
      expect(result?.related).toEqual(['rel1']);
      expect(result?.metadata).toEqual({ key: 'value' });
    });
  });

  describe('listKnowledge', () => {
    it('should list all knowledge entries', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { id: '1', category: 'concept', name: 'A', content: 'A', variables: '[]', related: '[]', metadata: '{}', created_at: new Date(), updated_at: new Date() },
        { id: '2', category: 'rule', name: 'B', content: 'B', variables: '[]', related: '[]', metadata: '{}', created_at: new Date(), updated_at: new Date() },
      ]);

      const result = await listKnowledge();

      expect(result).toHaveLength(2);
    });

    it('should filter by category', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { id: '1', category: 'concept', name: 'A', content: 'A', variables: '[]', related: '[]', metadata: '{}', created_at: new Date(), updated_at: new Date() },
      ]);

      await listKnowledge('concept');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE category = $1'),
        ['concept']
      );
    });
  });

  describe('searchKnowledge', () => {
    it('should search by name and content', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { id: '1', category: 'concept', name: 'Python', content: 'Python programming', variables: '[]', related: '[]', metadata: '{}', created_at: new Date(), updated_at: new Date() },
      ]);

      const result = await searchKnowledge('Python');

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Python');
    });

    it('should escape special characters', async () => {
      await searchKnowledge('test%value');

      const call = vi.mocked(query).mock.calls[0];
      // The function escapes % and _ with backslash
      expect(call[1][0]).toContain('test\\%value');
    });

    it('should filter by category when provided', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      await searchKnowledge('test', 'concept');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE category = $1'),
        ['concept', expect.any(String)]
      );
    });
  });

  describe('deleteKnowledge', () => {
    it('should delete knowledge entry', async () => {
      await deleteKnowledge('concept', 'TestConcept');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM knowledge_base'),
        ['concept', 'TestConcept']
      );
    });
  });
});
