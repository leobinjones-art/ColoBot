/**
 * Approval Full 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

import { query, queryOne } from '../memory/db.js';

describe('Approval Full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ApprovalFlow', () => {
    it('should create approval', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'approval-1',
        agent_id: 'agent-1',
        requester: 'user-1',
        action_type: 'exec',
        target_resource: 'test',
        status: 'pending',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 600000),
      });

      const { ApprovalFlow } = await import('../agent-runtime/approval.js');
      const flow = new ApprovalFlow();
      const result = await flow.create({
        agentId: 'agent-1',
        requester: 'user-1',
        channel: 'web',
        actionType: 'exec',
        targetResource: 'test',
      });

      expect(result.id).toBe('approval-1');
    });

    it('should get approval', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'approval-1',
        status: 'pending',
      });

      const { ApprovalFlow } = await import('../agent-runtime/approval.js');
      const flow = new ApprovalFlow();
      const result = await flow.get('approval-1');

      expect(result).not.toBeNull();
    });

    it('should return null for non-existent approval', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const { ApprovalFlow } = await import('../agent-runtime/approval.js');
      const flow = new ApprovalFlow();
      const result = await flow.get('non-existent');

      expect(result).toBeNull();
    });

    it('should list pending approvals', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      const { ApprovalFlow } = await import('../agent-runtime/approval.js');
      const flow = new ApprovalFlow();
      const result = await flow.pending();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should approve', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'approval-1',
        status: 'approved',
      });

      const { ApprovalFlow } = await import('../agent-runtime/approval.js');
      const flow = new ApprovalFlow();
      const result = await flow.approve('approval-1', 'admin', { approved: true });

      expect(result.status).toBe('approved');
    });

    it('should reject', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'approval-1',
        status: 'rejected',
      });

      const { ApprovalFlow } = await import('../agent-runtime/approval.js');
      const flow = new ApprovalFlow();
      const result = await flow.reject('approval-1', 'admin', { reason: 'test' });

      expect(result.status).toBe('rejected');
    });
  });
});