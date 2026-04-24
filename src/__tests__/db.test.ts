/**
 * Database Module 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock pg Pool before any imports
const mockQuery = vi.fn();
const mockEnd = vi.fn();

vi.mock('pg', () => ({
  default: {
    Pool: vi.fn().mockImplementation(() => ({
      query: mockQuery,
      end: mockEnd,
    })),
  },
}));

vi.stubEnv('DB_HOST', 'localhost');
vi.stubEnv('DB_PORT', '5432');
vi.stubEnv('DB_NAME', 'colobot');
vi.stubEnv('DB_USER', 'test');
vi.stubEnv('DB_PASSWORD', 'test123');

describe('Database Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockReset();
    mockEnd.mockReset();
  });

  describe('query', () => {
    it('should execute query and return rows', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'test' }],
        rowCount: 1,
      });

      // Re-import to get fresh module with mock
      vi.resetModules();
      const { query } = await import('../memory/db.js');

      const result = await query('SELECT * FROM agents');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
    });

    it('should execute query with params', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'agent-1', name: 'Test' }],
        rowCount: 1,
      });

      vi.resetModules();
      const { query } = await import('../memory/db.js');

      const result = await query('SELECT * FROM agents WHERE id = $1', ['agent-1']);

      expect(Array.isArray(result)).toBe(true);
      expect(mockQuery).toHaveBeenCalledWith(
        'SELECT * FROM agents WHERE id = $1',
        ['agent-1']
      );
    });

    it('should handle query error', async () => {
      mockQuery.mockRejectedValueOnce(new Error('Query failed'));

      vi.resetModules();
      const { query } = await import('../memory/db.js');

      await expect(query('SELECT * FROM invalid')).rejects.toThrow('Query failed');
    });

    it('should return empty array for no results', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      vi.resetModules();
      const { query } = await import('../memory/db.js');

      const result = await query('SELECT * FROM agents WHERE id = $1', ['nonexistent']);

      expect(result).toEqual([]);
    });
  });

  describe('queryOne', () => {
    it('should return first row', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ id: 'agent-1', name: 'Test' }],
        rowCount: 1,
      });

      vi.resetModules();
      const { queryOne } = await import('../memory/db.js');

      const result = await queryOne('SELECT * FROM agents WHERE id = $1', ['agent-1']);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('agent-1');
    });

    it('should return null for empty result', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      vi.resetModules();
      const { queryOne } = await import('../memory/db.js');

      const result = await queryOne('SELECT * FROM agents WHERE id = $1', ['non-existent']);

      expect(result).toBeNull();
    });
  });

  describe('closeDb', () => {
    it('should close pool', async () => {
      mockEnd.mockResolvedValueOnce(undefined);

      vi.resetModules();
      const { closeDb } = await import('../memory/db.js');

      await closeDb();

      expect(mockEnd).toHaveBeenCalled();
    });
  });
});