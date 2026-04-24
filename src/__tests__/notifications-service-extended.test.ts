/**
 * Notifications Service Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock settings-cache
vi.mock('../services/settings-cache.js', () => ({
  getMessageWebhookUrl: vi.fn(() => 'https://webhook.example.com'),
  getFeishuWebhookUrl: vi.fn(() => 'https://feishu.webhook.url'),
  getSmtpConfig: vi.fn(() => ({ host: 'smtp.example.com', port: 587, user: 'user', pass: 'pass', to: 'to@example.com', from: 'from@example.com' })),
  getTelegramConfig: vi.fn(() => ({ botToken: 'token', chatId: 'chat' })),
}));

// Mock feishu-notifications
vi.mock('../services/feishu-notifications.js', () => ({
  feishuNotificationsAdapter: {
    name: 'feishu_notifications',
    send: vi.fn(async () => {}),
  },
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Notifications Service Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('sendApprovalNotification', () => {
    it('should send notification with all fields', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => 'OK' });

      const { sendApprovalNotification } = await import('../services/notifications.js');
      await sendApprovalNotification({
        approvalId: 'approval-1',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'file_write',
        targetResource: '/tmp/test.txt',
        status: 'pending',
        description: 'Write to file',
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should send approved notification', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => 'OK' });

      const { sendApprovalNotification } = await import('../services/notifications.js');
      await sendApprovalNotification({
        approvalId: 'approval-2',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'exec',
        targetResource: 'npm test',
        status: 'approved',
        approver: 'admin-1',
      });

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should send rejected notification with reason', async () => {
      mockFetch.mockResolvedValue({ ok: true, text: async () => 'OK' });

      const { sendApprovalNotification } = await import('../services/notifications.js');
      await sendApprovalNotification({
        approvalId: 'approval-3',
        agentId: 'agent-1',
        requester: 'user-1',
        actionType: 'delete',
        targetResource: '/important/file',
        status: 'rejected',
        reason: 'Cannot delete important file',
        approver: 'admin-1',
      });

      expect(mockFetch).toHaveBeenCalled();
    });
  });
});