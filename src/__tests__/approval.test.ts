import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApprovalFlow, ApprovalActionType, ApprovalStatus } from '../agent-runtime/approval.js';
import { query, queryOne } from '../memory/db.js';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

describe('approval', () => {
  let approvalFlow: ApprovalFlow;

  beforeEach(() => {
    vi.clearAllMocks();
    approvalFlow = new ApprovalFlow();
  });

  describe('ApprovalFlow', () => {
    describe('create', () => {
      it('should create approval request with default expiry', async () => {
        const mockApproval = {
          id: 'approval-123',
          agent_id: 'agent-1',
          requester: 'user-1',
          action_type: 'exec' as ApprovalActionType,
          target_resource: 'test_resource',
          description: 'Test approval',
          payload: { channel: 'web' },
          status: 'pending' as ApprovalStatus,
          created_at: new Date(),
          expires_at: new Date(Date.now() + 10 * 60 * 1000),
          decided_at: null,
          approver: null,
          result: {},
        };

        (queryOne as any).mockResolvedValue(mockApproval);

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
        expect(result.action_type).toBe('exec');
        expect(queryOne).toHaveBeenCalled();
      });

      it('should create approval request with custom expiry', async () => {
        const mockApproval = {
          id: 'approval-124',
          agent_id: 'agent-1',
          requester: 'user-1',
          action_type: 'delete' as ApprovalActionType,
          target_resource: 'test_resource',
          description: null,
          payload: { channel: 'feishu' },
          status: 'pending' as ApprovalStatus,
          created_at: new Date(),
          expires_at: new Date(Date.now() + 30 * 60 * 1000),
          decided_at: null,
          approver: null,
          result: {},
        };

        (queryOne as any).mockResolvedValue(mockApproval);

        const result = await approvalFlow.create({
          agentId: 'agent-1',
          requester: 'user-1',
          channel: 'feishu',
          actionType: 'delete',
          targetResource: 'test_resource',
          expiresInMinutes: 30,
        });

        expect(result.id).toBe('approval-124');
        expect(result.action_type).toBe('delete');
      });
    });

    describe('get', () => {
      it('should return approval request by id', async () => {
        const mockApproval = {
          id: 'approval-123',
          agent_id: 'agent-1',
          requester: 'user-1',
          action_type: 'exec' as ApprovalActionType,
          target_resource: 'test_resource',
          description: 'Test',
          payload: {},
          status: 'pending' as ApprovalStatus,
          created_at: new Date(),
          expires_at: null,
          decided_at: null,
          approver: null,
          result: {},
        };

        (queryOne as any).mockResolvedValue(mockApproval);

        const result = await approvalFlow.get('approval-123');

        expect(result).not.toBeNull();
        expect(result!.id).toBe('approval-123');
        expect(queryOne).toHaveBeenCalledWith(
          expect.stringContaining('SELECT * FROM approval_requests WHERE id = $1'),
          ['approval-123']
        );
      });

      it('should return null when approval not found', async () => {
        (queryOne as any).mockResolvedValue(null);

        const result = await approvalFlow.get('non-existent');

        expect(result).toBeNull();
      });
    });

    describe('pending', () => {
      it('should list pending approvals', async () => {
        const mockApprovals = [
          {
            id: 'approval-1',
            agent_id: 'agent-1',
            requester: 'user-1',
            action_type: 'exec' as ApprovalActionType,
            target_resource: 'resource-1',
            description: 'Test 1',
            payload: {},
            status: 'pending' as ApprovalStatus,
            created_at: new Date(),
            expires_at: null,
            decided_at: null,
            approver: null,
            result: {},
          },
          {
            id: 'approval-2',
            agent_id: 'agent-2',
            requester: 'user-2',
            action_type: 'delete' as ApprovalActionType,
            target_resource: 'resource-2',
            description: 'Test 2',
            payload: {},
            status: 'pending' as ApprovalStatus,
            created_at: new Date(),
            expires_at: null,
            decided_at: null,
            approver: null,
            result: {},
          },
        ];

        (query as any).mockResolvedValue(mockApprovals);

        const result = await approvalFlow.pending();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('approval-1');
        expect(result[1].id).toBe('approval-2');
      });

      it('should return empty array when no approvals', async () => {
        (query as any).mockResolvedValue([]);

        const result = await approvalFlow.pending();

        expect(result).toEqual([]);
      });
    });

    describe('approve', () => {
      it('should approve a pending request', async () => {
        const mockApproved = {
          id: 'approval-123',
          agent_id: 'agent-1',
          requester: 'user-1',
          action_type: 'exec' as ApprovalActionType,
          target_resource: 'test_resource',
          description: 'Test',
          payload: {},
          status: 'approved' as ApprovalStatus,
          created_at: new Date(),
          expires_at: null,
          decided_at: new Date(),
          approver: 'admin',
          result: { approved: true },
        };

        (queryOne as any).mockResolvedValue(mockApproved);

        const result = await approvalFlow.approve('approval-123', 'admin', { approved: true });

        expect(result.status).toBe('approved');
        expect(result.approver).toBe('admin');
        expect(result.decided_at).not.toBeNull();
      });
    });

    describe('reject', () => {
      it('should reject a pending request', async () => {
        const mockRejected = {
          id: 'approval-123',
          agent_id: 'agent-1',
          requester: 'user-1',
          action_type: 'exec' as ApprovalActionType,
          target_resource: 'test_resource',
          description: 'Test',
          payload: {},
          status: 'rejected' as ApprovalStatus,
          created_at: new Date(),
          expires_at: null,
          decided_at: new Date(),
          approver: 'admin',
          result: { reason: 'Not allowed' },
        };

        (queryOne as any).mockResolvedValue(mockRejected);

        const result = await approvalFlow.reject('approval-123', 'admin', { reason: 'Not allowed' });

        expect(result.status).toBe('rejected');
        expect(result.approver).toBe('admin');
      });
    });
  });

  describe('ApprovalActionType', () => {
    it('should support all action types', () => {
      const actionTypes: ApprovalActionType[] = ['update', 'delete', 'exec', 'send', 'uninstall'];
      expect(actionTypes).toHaveLength(5);
      expect(actionTypes).toContain('update');
      expect(actionTypes).toContain('delete');
      expect(actionTypes).toContain('exec');
      expect(actionTypes).toContain('send');
      expect(actionTypes).toContain('uninstall');
    });
  });

  describe('ApprovalStatus', () => {
    it('should support all status types', () => {
      const statuses: ApprovalStatus[] = ['pending', 'approved', 'rejected', 'expired'];
      expect(statuses).toHaveLength(4);
      expect(statuses).toContain('pending');
      expect(statuses).toContain('approved');
      expect(statuses).toContain('rejected');
      expect(statuses).toContain('expired');
    });
  });
});