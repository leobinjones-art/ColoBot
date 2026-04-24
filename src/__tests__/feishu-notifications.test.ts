/**
 * Feishu Notifications 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock settings
vi.mock('../services/settings.js', () => ({
  getSetting: vi.fn(async () => null),
  SETTINGS_KEYS: {
    FEISHU_APPROVER_OPEN_ID: 'feishu_approver_open_id',
    COLOBOT_PUBLIC_URL: 'colobot_public_url',
  },
}));

// Mock feishu client
vi.mock('../services/feishu.js', () => ({
  feishuClient: {
    sendInteractiveCard: vi.fn(async () => 'msg_123'),
  },
}));

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
}));

import { feishuNotificationsAdapter, buildApprovalCard } from '../services/feishu-notifications.js';

describe('Feishu Notifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('feishuNotificationsAdapter', () => {
    it('should have correct name', () => {
      expect(feishuNotificationsAdapter.name).toBe('feishu-notifications');
    });

    it('should skip if no approver configured', async () => {
      const { getSetting } = await import('../services/settings.js');
      vi.mocked(getSetting).mockResolvedValue(null);

      await feishuNotificationsAdapter.send({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user',
        actionType: 'test',
        targetResource: 'test',
        status: 'pending',
      });

      // Should complete without error
    });
  });

  describe('buildApprovalCard', () => {
    it('should build pending approval card', () => {
      const card = buildApprovalCard({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user',
        actionType: 'file_write',
        targetResource: '/tmp/test.txt',
        status: 'pending',
      });

      expect(card).toHaveProperty('msg_type', 'interactive');
      expect(card).toHaveProperty('card');
    });

    it('should build approved card', () => {
      const card = buildApprovalCard({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user',
        actionType: 'test',
        targetResource: 'test',
        status: 'approved',
        approver: 'admin',
      });

      const cardObj = card as { card: { header: { template: string } } };
      expect(cardObj.card.header.template).toBe('green');
    });

    it('should build rejected card', () => {
      const card = buildApprovalCard({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user',
        actionType: 'test',
        targetResource: 'test',
        status: 'rejected',
        reason: 'Not allowed',
      });

      const cardObj = card as { card: { header: { template: string } } };
      expect(cardObj.card.header.template).toBe('red');
    });

    it('should include approve/reject buttons for pending', () => {
      const card = buildApprovalCard({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user',
        actionType: 'test',
        targetResource: 'test',
        status: 'pending',
      });

      const cardObj = card as { card: { elements: unknown[] } };
      const hasAction = cardObj.card.elements.some(
        (e: any) => e.tag === 'action'
      );
      expect(hasAction).toBe(true);
    });

    it('should not include buttons for non-pending', () => {
      const card = buildApprovalCard({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user',
        actionType: 'test',
        targetResource: 'test',
        status: 'approved',
      });

      const cardObj = card as { card: { elements: unknown[] } };
      const hasAction = cardObj.card.elements.some(
        (e: any) => e.tag === 'action'
      );
      expect(hasAction).toBe(false);
    });

    it('should use custom base URL', () => {
      const card = buildApprovalCard({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user',
        actionType: 'test',
        targetResource: 'test',
        status: 'pending',
      }, 'https://custom.url');

      const cardStr = JSON.stringify(card);
      expect(cardStr).toContain('https://custom.url');
    });

    it('should include description when provided', () => {
      const card = buildApprovalCard({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user',
        actionType: 'test',
        targetResource: 'test',
        description: 'Test description',
        status: 'pending',
      });

      const cardStr = JSON.stringify(card);
      expect(cardStr).toContain('Test description');
    });
  });
});