/**
 * Audit Service 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

describe('Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('writeAudit', () => {
    it('should write audit entry', async () => {
      const { writeAudit } = await import('../services/audit.js');
      await writeAudit({
        agentId: 'agent-1',
        action: 'test_action',
        resource: 'test_resource',
        result: 'success',
      });

      // Should not throw
    });
  });

  describe('listAudit', () => {
    it('should return audit logs', async () => {
      const { listAudit } = await import('../services/audit.js');
      const result = await listAudit({ agentId: 'agent-1' });

      expect(result).toBeDefined();
      expect(Array.isArray(result.logs)).toBe(true);
    });
  });
});