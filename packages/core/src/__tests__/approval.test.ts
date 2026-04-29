/**
 * Approval 模块测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}))

describe('Approval Module', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Approval Flow', () => {
    it('should create approval request', async () => {
      const { ApprovalFlow } = await import('../approval/index.js')
      const { queryOne } = await import('../memory/db.js')

      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'approval-1',
        agent_id: 'agent-1',
        requester: 'user-1',
        action_type: 'delete',
        target_resource: '/important/data.txt',
        description: 'test',
        payload: {},
        status: 'pending',
        created_at: new Date(),
        expires_at: new Date(),
        decided_at: null,
        approver: null,
        result: {},
      })

      const flow = new ApprovalFlow()
      const request = await flow.create({
        agentId: 'agent-1',
        requester: 'user-1',
        channel: 'test',
        actionType: 'delete',
        targetResource: '/important/data.txt',
      })

      expect(request).toBeDefined()
      expect(request.status).toBe('pending')
    })

    it('should get pending approvals', async () => {
      const { ApprovalFlow } = await import('../approval/index.js')
      const { query } = await import('../memory/db.js')

      vi.mocked(query).mockResolvedValueOnce([])

      const flow = new ApprovalFlow()
      const pending = await flow.pending('agent-1')
      expect(Array.isArray(pending)).toBe(true)
    })

    it('should approve request', async () => {
      const { ApprovalFlow } = await import('../approval/index.js')
      const { queryOne } = await import('../memory/db.js')

      vi.mocked(queryOne)
        .mockResolvedValueOnce({
          id: 'approval-1',
          agent_id: 'agent-1',
          requester: 'user-1',
          action_type: 'read',
          target_resource: '/tmp/test.txt',
          description: 'test',
          payload: {},
          status: 'pending',
          created_at: new Date(),
          expires_at: new Date(),
          decided_at: null,
          approver: null,
          result: {},
        })
        .mockResolvedValueOnce({
          id: 'approval-1',
          agent_id: 'agent-1',
          requester: 'user-1',
          action_type: 'read',
          target_resource: '/tmp/test.txt',
          description: 'test',
          payload: {},
          status: 'approved',
          created_at: new Date(),
          expires_at: new Date(),
          decided_at: new Date(),
          approver: 'user-1',
          result: {},
        })

      const flow = new ApprovalFlow()

      // 批准
      await flow.approve('approval-1', 'user-1', { note: 'Approved for testing' })

      expect(queryOne).toHaveBeenCalled()
    })

    it('should reject request', async () => {
      const { ApprovalFlow } = await import('../approval/index.js')
      const { queryOne } = await import('../memory/db.js')

      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'approval-1',
        agent_id: 'agent-1',
        requester: 'user-1',
        action_type: 'delete',
        target_resource: '/etc/passwd',
        description: 'test',
        payload: {},
        status: 'rejected',
        created_at: new Date(),
        expires_at: new Date(),
        decided_at: new Date(),
        approver: 'user-1',
        result: { reason: 'Dangerous operation' },
      })

      const flow = new ApprovalFlow()
      await flow.reject('approval-1', 'user-1', 'Dangerous operation')

      expect(queryOne).toHaveBeenCalled()
    })
  })

  describe('Danger Level Check', () => {
    it('should check dangerous level', async () => {
      const { checkDangerousLevel } = await import('../approval/index.js')

      const result = await checkDangerousLevel({
        id: 'tc-1',
        name: 'delete_file',
        args: { path: '/important/data.txt' },
        type: 'function',
        function: { name: 'delete_file', arguments: '{}' },
      })

      expect(result.level).toBeDefined()
    })

    it('should detect commercial documents', async () => {
      const { isCommercialDocument } = await import('../approval/index.js')

      expect(isCommercialDocument('合同文件')).toBe(true)
      expect(isCommercialDocument('普通文件')).toBe(false)
    })
  })
})
