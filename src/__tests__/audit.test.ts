/**
 * Audit Service 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

import { query, queryOne } from '../memory/db.js';
import { listAudit, writeAudit } from '../services/audit.js';

describe('Audit Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('writeAudit', () => {
    it('should write audit log', async () => {
      await writeAudit({
        actorType: 'user',
        actorId: 'user-1',
        actorName: 'Test User',
        action: 'login',
        result: 'success',
      });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining(['user', 'user-1', 'Test User', 'login'])
      );
    });

    it('should handle all optional fields', async () => {
      await writeAudit({
        actorType: 'agent',
        actorId: 'agent-1',
        actorName: 'ColoBot',
        action: 'tool_call',
        targetType: 'file',
        targetId: '/etc/passwd',
        targetName: 'passwd',
        detail: { tool: 'read_file' },
        ipAddress: '192.168.1.1',
        channel: 'websocket',
        result: 'blocked',
        errorMessage: 'Permission denied',
      });

      expect(query).toHaveBeenCalled();
    });

    it('should default result to success', async () => {
      await writeAudit({
        actorType: 'system',
        action: 'startup',
      });

      const call = vi.mocked(query).mock.calls[0];
      expect(call[1]).toContain('success');
    });
  });

  describe('listAudit', () => {
    it('should list audit logs', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ count: '2' });
      vi.mocked(query).mockResolvedValueOnce([
        { id: '1', actor_type: 'user', actor_id: 'u1', actor_name: 'User', action: 'login', target_type: null, target_id: null, target_name: null, detail: '{}', ip_address: null, channel: null, result: 'success', error_message: null, created_at: new Date() },
        { id: '2', actor_type: 'agent', actor_id: 'a1', actor_name: 'Agent', action: 'tool_call', target_type: null, target_id: null, target_name: null, detail: '{}', ip_address: null, channel: null, result: 'success', error_message: null, created_at: new Date() },
      ]);

      const result = await listAudit();

      expect(result.logs).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by action', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ count: '1' });
      vi.mocked(query).mockResolvedValueOnce([]);

      await listAudit({ action: 'login' });

      const countCall = vi.mocked(queryOne).mock.calls[0];
      expect(countCall[0]).toContain('action = $1');
    });

    it('should filter by actorId', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ count: '0' });
      vi.mocked(query).mockResolvedValueOnce([]);

      await listAudit({ actorId: 'user-1' });

      const countCall = vi.mocked(queryOne).mock.calls[0];
      expect(countCall[0]).toContain('actor_id = $');
    });

    it('should filter by date range', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ count: '0' });
      vi.mocked(query).mockResolvedValueOnce([]);

      const from = new Date('2024-01-01');
      const to = new Date('2024-12-31');

      await listAudit({ from, to });

      const countCall = vi.mocked(queryOne).mock.calls[0];
      expect(countCall[0]).toContain('created_at >=');
      expect(countCall[0]).toContain('created_at <=');
    });

    it('should support pagination', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ count: '100' });
      vi.mocked(query).mockResolvedValueOnce([]);

      await listAudit({ limit: 20, offset: 40 });

      const listCall = vi.mocked(query).mock.calls[0];
      expect(listCall[1]).toContain(20);
      expect(listCall[1]).toContain(40);
    });

    it('should parse detail JSON', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ count: '1' });
      vi.mocked(query).mockResolvedValueOnce([
        { id: '1', actor_type: 'user', actor_id: 'u1', actor_name: 'User', action: 'login', target_type: null, target_id: null, target_name: null, detail: '{"key": "value"}', ip_address: null, channel: null, result: 'success', error_message: null, created_at: new Date() },
      ]);

      const result = await listAudit();

      expect(result.logs[0].detail).toEqual({ key: 'value' });
    });
  });
});
