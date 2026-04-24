/**
 * Database Module 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pg
vi.mock('pg', () => ({
  Pool: vi.fn().mockImplementation(() => ({
    query: vi.fn(async (sql, params) => ({
      rows: [],
      rowCount: 0,
    })),
    end: vi.fn(async () => {}),
  })),
}));

vi.stubEnv('DB_HOST', 'localhost');
vi.stubEnv('DB_PORT', '5432');
vi.stubEnv('DB_NAME', 'colobot');
vi.stubEnv('DB_USER', 'test');
vi.stubEnv('DB_PASSWORD', 'test123');

describe('Database Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('query', () => {
    it('should execute query and return rows', async () => {
      // Import after mock
      const { query } = await import('../memory/db.js');

      const result = await query('SELECT * FROM agents');

      expect(Array.isArray(result)).toBe(true);
    });

    it('should execute query with params', async () => {
      const { query } = await import('../memory/db.js');

      const result = await query('SELECT * FROM agents WHERE id = $1', ['agent-1']);

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle query error', async () => {
      const pg = await import('pg');
      const mockPool = vi.mocked(pg.Pool).mock.results[0].value;
      mockPool.query.mockRejectedValueOnce(new Error('Query failed'));

      const { query } = await import('../memory/db.js');

      await expect(query('SELECT * FROM invalid')).rejects.toThrow();
    });
  });

  describe('queryOne', () => {
    it('should return first row', async () => {
      const pg = await import('pg');
      const mockPool = vi.mocked(pg.Pool).mock.results[0].value;
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 'agent-1', name: 'Test' }],
        rowCount: 1,
      });

      const { queryOne } = await import('../memory/db.js');

      const result = await queryOne('SELECT * FROM agents WHERE id = $1', ['agent-1']);

      expect(result).not.toBeNull();
    });

    it('should return null for empty result', async () => {
      const pg = await import('pg');
      const mockPool = vi.mocked(pg.Pool).mock.results[0].value;
      mockPool.query.mockResolvedValueOnce({
        rows: [],
        rowCount: 0,
      });

      const { queryOne } = await import('../memory/db.js');

      const result = await queryOne('SELECT * FROM agents WHERE id = $1', ['non-existent']);

      expect(result).toBeNull();
    });
  });

  describe('closeDb', () => {
    it('should close pool', async () => {
      const { closeDb } = await import('../memory/db.js');

      await closeDb();

      // Should not throw
    });
  });
});