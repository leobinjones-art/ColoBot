/**
 * Settings Service 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

describe('Settings Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return settings', async () => {
      const { getSettings } = await import('../services/settings.js');
      const result = await getSettings(['key1', 'key2']);

      expect(result).toBeDefined();
    });
  });

  describe('getSetting', () => {
    it('should return single setting', async () => {
      const { getSetting } = await import('../services/settings.js');
      const result = await getSetting('test_key');

      expect(result).toBeNull();
    });
  });

  describe('setSetting', () => {
    it('should set setting', async () => {
      const { setSetting } = await import('../services/settings.js');
      await setSetting('test_key', 'test_value');

      // Should not throw
    });
  });

  describe('setSettings', () => {
    it('should set multiple settings', async () => {
      const { setSettings } = await import('../services/settings.js');
      await setSettings({ key1: 'value1', key2: 'value2' });

      // Should not throw
    });
  });

  describe('getFeishuSettings', () => {
    it('should return feishu settings', async () => {
      const { getFeishuSettings } = await import('../services/settings.js');
      const result = await getFeishuSettings();

      expect(result).toBeDefined();
    });
  });

  describe('getLLMSettings', () => {
    it('should return LLM settings', async () => {
      const { getLLMSettings } = await import('../services/settings.js');
      const result = await getLLMSettings();

      expect(result).toBeDefined();
    });
  });
});