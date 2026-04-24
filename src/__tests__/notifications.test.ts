/**
 * Notifications Service 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock settings-cache
vi.mock('../services/settings-cache.js', () => ({
  getMessageWebhookUrl: vi.fn(() => null),
  getFeishuWebhookUrl: vi.fn(() => 'https://feishu.webhook.url'),
  getSmtpConfig: vi.fn(() => ({ host: '', port: 587, user: '', pass: '', to: '', from: '' })),
  getTelegramConfig: vi.fn(() => ({ botToken: '', chatId: '' })),
}));

// Mock feishu-notifications
vi.mock('../services/feishu-notifications.js', () => ({
  feishuNotificationsAdapter: {
    name: 'feishu_notifications',
    send: vi.fn(async () => {}),
  },
}));

import { sendApprovalNotification } from '../services/notifications.js';

describe('Notifications Service', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  describe('sendApprovalNotification', () => {
    it('should send notification to enabled channels', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendApprovalNotification({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'file_write',
        targetResource: '/tmp/test.txt',
        status: 'pending',
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle multiple channels', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await sendApprovalNotification({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'tool_call',
        targetResource: 'execute_command',
        status: 'approved',
        approver: 'admin-1',
      });

      // Should complete without error
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle channel failures gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      // Should not throw, just log error
      await sendApprovalNotification({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'test',
        targetResource: 'test',
        status: 'pending',
      });
    });

    it('should include correct emoji for status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendApprovalNotification({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'test',
        targetResource: 'test',
        status: 'approved',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.card.header.title.content).toContain('✅');
    });

    it('should include rejection emoji', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      await sendApprovalNotification({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'test',
        targetResource: 'test',
        status: 'rejected',
        reason: 'Permission denied',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.card.header.title.content).toContain('❌');
    });
  });
});