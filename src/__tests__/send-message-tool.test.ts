/**
 * Send Message Tool 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn((name, handler) => {
    (global as any).__registeredTools = (global as any).__registeredTools || {};
    (global as any).__registeredTools[name] = handler;
  }),
}));

// Mock settings-cache
vi.mock('../services/settings-cache.js', () => ({
  getMessageWebhookUrl: vi.fn(() => 'https://webhook.example.com'),
  getFeishuWebhookUrl: vi.fn(() => 'https://feishu.webhook.url'),
  getSmtpConfig: vi.fn(() => ({ host: 'smtp.example.com', port: 587, user: 'user', pass: 'pass', to: 'to@example.com', from: 'from@example.com' })),
  getTelegramConfig: vi.fn(() => ({ botToken: 'token', chatId: 'chat' })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Send Message Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
    (global as any).__registeredTools = {};
  });

  describe('registerTools', () => {
    it('should register send_message tool', async () => {
      const { registerTools } = await import('../agent-runtime/tools/send-message.js');
      registerTools();

      expect((global as any).__registeredTools['send_message']).toBeDefined();
    });
  });

  describe('send_message handler', () => {
    it('should send webhook message', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'OK' });

      const { registerTools } = await import('../agent-runtime/tools/send-message.js');
      registerTools();

      const handler = (global as any).__registeredTools['send_message'];
      const result = await handler({ channel: 'webhook', content: 'Hello' });

      expect(result).toBeDefined();
      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw when content is missing', async () => {
      const { registerTools } = await import('../agent-runtime/tools/send-message.js');
      registerTools();

      const handler = (global as any).__registeredTools['send_message'];
      await expect(handler({ channel: 'webhook' })).rejects.toThrow('content is required');
    });

    it('should send feishu message', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'OK' });

      const { registerTools } = await import('../agent-runtime/tools/send-message.js');
      registerTools();

      const handler = (global as any).__registeredTools['send_message'];
      const result = await handler({ channel: 'feishu', content: 'Hello Feishu' });

      expect(result).toBeDefined();
    });

    it('should send telegram message', async () => {
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200, text: async () => 'OK' });

      const { registerTools } = await import('../agent-runtime/tools/send-message.js');
      registerTools();

      const handler = (global as any).__registeredTools['send_message'];
      const result = await handler({ channel: 'telegram', content: 'Hello Telegram' });

      expect(result).toBeDefined();
    });
  });
});