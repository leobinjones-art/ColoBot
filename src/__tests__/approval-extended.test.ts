/**
 * Approval Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

import { queryOne } from '../memory/db.js';

describe('Approval Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ApprovalFlow extended', () => {
    it('should create approval with all fields', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'approval-123',
        agent_id: 'agent-1',
        requester: 'user-1',
        action_type: 'exec',
        target_resource: 'test_resource',
        description: 'Test approval',
        payload: { channel: 'web' },
        status: 'pending',
        created_at: new Date(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        decided_at: null,
        approver: null,
        result: {},
      });

      const { ApprovalFlow } = await import('../agent-runtime/approval.js');
      const approvalFlow = new ApprovalFlow();
      const result = await approvalFlow.create({
        agentId: 'agent-1',
        requester: 'user-1',
        channel: 'web',
        actionType: 'exec',
        targetResource: 'test_resource',
        description: 'Test approval',
      });

      expect(result.id).toBe('approval-123');
      expect(result.status).toBe('pending');
    });

    it('should get pending approvals', async () => {
      const { ApprovalFlow } = await import('../agent-runtime/approval.js');
      const approvalFlow = new ApprovalFlow();
      const result = await approvalFlow.pending();

      expect(Array.isArray(result)).toBe(true);
    });

    it('should approve request', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'approval-123',
        status: 'approved',
        approver: 'admin',
      });

      const { ApprovalFlow } = await import('../agent-runtime/approval.js');
      const approvalFlow = new ApprovalFlow();
      const result = await approvalFlow.approve('approval-123', 'admin', { approved: true });

      expect(result.status).toBe('approved');
    });

    it('should reject request', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'approval-123',
        status: 'rejected',
        approver: 'admin',
      });

      const { ApprovalFlow } = await import('../agent-runtime/approval.js');
      const approvalFlow = new ApprovalFlow();
      const result = await approvalFlow.reject('approval-123', 'admin', { reason: 'Not allowed' });

      expect(result.status).toBe('rejected');
    });
  });
});