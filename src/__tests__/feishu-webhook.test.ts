/**
 * Feishu Webhook 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock settings
vi.mock('../services/settings.js', () => ({
  getSetting: vi.fn(async () => null),
  SETTINGS_KEYS: {
    FEISHU_AGENT_ID: 'feishu_agent_id',
  },
}));

import { handleFeishuEvent } from '../routes/feishu-webhook.js';

describe('Feishu Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleFeishuEvent', () => {
    it('should handle challenge verification', async () => {
      const mockReq = {
        headers: {},
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'data') cb(Buffer.from('{"challenge":"test-challenge-123"}'));
          if (event === 'end') cb();
        }),
      } as any;

      const result = await handleFeishuEvent(mockReq);

      expect(result).toEqual({ challenge: 'test-challenge-123' });
    });

    it('should return ok for valid event', async () => {
      vi.stubEnv('LARK_VERIFICATION_TOKEN', '');
      const mockReq = {
        headers: {},
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'data') cb(Buffer.from('{"event":{"type":"test"}}'));
          if (event === 'end') cb();
        }),
      } as any;

      const result = await handleFeishuEvent(mockReq);

      expect(result).toEqual({ ok: true });
    });

    it('should handle invalid JSON', async () => {
      const mockReq = {
        headers: {},
        on: vi.fn((event: string, cb: Function) => {
          if (event === 'data') cb(Buffer.from('not valid json'));
          if (event === 'end') cb();
        }),
      } as any;

      await expect(handleFeishuEvent(mockReq)).rejects.toThrow('Invalid JSON');
    });
  });
});