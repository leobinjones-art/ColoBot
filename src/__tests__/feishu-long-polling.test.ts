/**
 * Feishu Long Polling 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock settings
vi.mock('./settings.js', () => ({
  getSettings: vi.fn(async () => ({})),
  SETTINGS_KEYS: {
    LARK_APP_ID: 'lark_app_id',
    LARK_APP_SECRET: 'lark_app_secret',
  },
}));

// Mock lark SDK
vi.mock('@larksuiteoapi/node-sdk', () => ({
  WSClient: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
  })),
  EventDispatcher: vi.fn().mockImplementation(() => ({
    register: vi.fn().mockReturnThis(),
  })),
  Domain: {
    Feishu: 'feishu',
  },
}));

describe('Feishu Long Polling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('startLongPolling', () => {
    it('should skip when not configured', async () => {
      vi.stubEnv('LARK_APP_ID', '');
      vi.stubEnv('LARK_APP_SECRET', '');

      const { startLongPolling } = await import('../services/feishu-long-polling.js');
      await startLongPolling();

      // Should not throw
    });

    it('should start when configured', async () => {
      vi.stubEnv('LARK_APP_ID', 'test-app-id');
      vi.stubEnv('LARK_APP_SECRET', 'test-app-secret');

      const { startLongPolling } = await import('../services/feishu-long-polling.js');
      await startLongPolling();

      // Should not throw
    });
  });

  describe('stopLongPolling', () => {
    it('should stop gracefully', async () => {
      const { stopLongPolling } = await import('../services/feishu-long-polling.js');
      await stopLongPolling();

      // Should not throw
    });
  });
});