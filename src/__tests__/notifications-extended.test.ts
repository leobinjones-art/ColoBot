/**
 * Notifications Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock settings-cache
vi.mock('../services/settings-cache.js', () => ({
  getMessageWebhookUrl: vi.fn(() => 'https://webhook.example.com'),
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

describe('Notifications Extended', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  describe('sendApprovalNotification with all statuses', () => {
    it('should send approved notification', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const { sendApprovalNotification } = await import('../services/notifications.js');
      await sendApprovalNotification({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'file_write',
        targetResource: '/tmp/test.txt',
        status: 'approved',
        approver: 'admin-1',
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should send rejected notification', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const { sendApprovalNotification } = await import('../services/notifications.js');
      await sendApprovalNotification({
        approvalId: 'approval-2',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'exec',
        targetResource: 'rm -rf /',
        status: 'rejected',
        reason: 'Dangerous command',
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should send pending notification', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const { sendApprovalNotification } = await import('../services/notifications.js');
      await sendApprovalNotification({
        approvalId: 'approval-3',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'send',
        targetResource: 'email',
        status: 'pending',
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { sendApprovalNotification } = await import('../services/notifications.js');
      // Should not throw
      await sendApprovalNotification({
        approvalId: 'approval-4',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'test',
        targetResource: 'test',
        status: 'pending',
      });
    });
  });
});