/**
 * Feishu Client 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock settings
vi.mock('../services/settings.js', () => ({
  getSettings: vi.fn(async () => ({
    lark_app_id: 'test_app_id',
    lark_app_secret: 'test_secret',
  })),
  SETTINGS_KEYS: {
    LARK_APP_ID: 'lark_app_id',
    LARK_APP_SECRET: 'lark_app_secret',
  },
}));

vi.stubEnv('LARK_APP_ID', 'env_app_id');
vi.stubEnv('LARK_APP_SECRET', 'env_secret');

describe('Feishu Client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    // Reset modules to get fresh singleton
    vi.resetModules();
  });

  describe('getToken', () => {
    it('should get token from API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 0,
          tenant_access_token: 'test_token',
          expire: 7200,
        }),
      });

      const { feishuClient } = await import('../services/feishu.js');
      const token = await feishuClient.getToken();

      expect(token).toBe('test_token');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          code: 10001,
          tenant_access_token: '',
          expire: 0,
        }),
      });

      const { feishuClient } = await import('../services/feishu.js');
      await expect(feishuClient.getToken()).rejects.toThrow();
    });

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const { feishuClient } = await import('../services/feishu.js');
      await expect(feishuClient.getToken()).rejects.toThrow();
    });
  });

  describe('sendInteractiveCard', () => {
    it('should send card and return message_id', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            code: 0,
            tenant_access_token: 'token',
            expire: 7200,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            code: 0,
            msg: 'success',
            data: { message_id: 'msg_123' },
          }),
        });

      const { feishuClient } = await import('../services/feishu.js');
      const messageId = await feishuClient.sendInteractiveCard('user_1', {
        header: { title: { tag: 'plain_text', content: 'Test' } },
      });

      expect(messageId).toBe('msg_123');
    });

    it('should throw on send error', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            code: 0,
            tenant_access_token: 'token',
            expire: 7200,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            code: 10002,
            msg: 'Invalid user',
          }),
        });

      const { feishuClient } = await import('../services/feishu.js');
      await expect(feishuClient.sendInteractiveCard('invalid_user', {})).rejects.toThrow();
    });
  });

  describe('updateMessage', () => {
    it('should update existing message', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            code: 0,
            tenant_access_token: 'token',
            expire: 7200,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ code: 0, msg: 'success' }),
        });

      const { feishuClient } = await import('../services/feishu.js');
      await feishuClient.updateMessage('msg_123', {
        header: { title: { tag: 'plain_text', content: 'Updated' } },
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('sendTextMessage', () => {
    it('should send text message', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            code: 0,
            tenant_access_token: 'token',
            expire: 7200,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            code: 0,
            msg: 'success',
            data: { message_id: 'msg_456' },
          }),
        });

      const { feishuClient } = await import('../services/feishu.js');
      await feishuClient.sendTextMessage('user_1', 'Hello');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });
});