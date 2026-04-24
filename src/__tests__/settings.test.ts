/**
 * Settings Service 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

import { query, queryOne } from '../memory/db.js';
import {
  getSetting,
  getSettings,
  setSetting,
  setSettings,
  deleteSetting,
  getFeishuSettings,
  saveFeishuSettings,
  getLLMSettings,
  saveLLMSettings,
  SETTINGS_KEYS,
} from '../services/settings.js';

describe('Settings Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSetting', () => {
    it('should return setting value', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({ value: 'test-value' });

      const result = await getSetting('test_key');

      expect(result).toBe('test-value');
    });

    it('should return null if not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const result = await getSetting('non_existent');

      expect(result).toBeNull();
    });
  });

  describe('getSettings', () => {
    it('should return multiple settings', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { key: 'key1', value: 'value1' },
        { key: 'key2', value: 'value2' },
      ]);

      const result = await getSettings(['key1', 'key2']);

      expect(result.key1).toBe('value1');
      expect(result.key2).toBe('value2');
    });

    it('should return empty object for empty keys', async () => {
      const result = await getSettings([]);

      expect(result).toEqual({});
    });
  });

  describe('setSetting', () => {
    it('should insert or update setting', async () => {
      await setSetting('test_key', 'test_value');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app_settings'),
        ['test_key', 'test_value', null]
      );
    });

    it('should include description when provided', async () => {
      await setSetting('test_key', 'test_value', 'Test description');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO app_settings'),
        ['test_key', 'test_value', 'Test description']
      );
    });
  });

  describe('setSettings', () => {
    it('should set multiple settings', async () => {
      await setSettings({ key1: 'value1', key2: 'value2' });

      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('deleteSetting', () => {
    it('should delete setting', async () => {
      await deleteSetting('test_key');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM app_settings'),
        ['test_key']
      );
    });
  });

  describe('getFeishuSettings', () => {
    it('should return feishu settings with DB values', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { key: SETTINGS_KEYS.LARK_APP_ID, value: 'db_app_id' },
        { key: SETTINGS_KEYS.LARK_APP_SECRET, value: 'db_secret' },
      ]);

      const result = await getFeishuSettings();

      expect(result.lark_app_id).toBe('db_app_id');
    });

    it('should fallback to env vars', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      const result = await getFeishuSettings();

      // Should use env or empty string
      expect(result.lark_app_id).toBeDefined();
    });
  });

  describe('saveFeishuSettings', () => {
    it('should save feishu settings', async () => {
      await saveFeishuSettings({
        lark_app_id: 'new_app_id',
        lark_app_secret: 'new_secret',
      });

      expect(query).toHaveBeenCalledTimes(2);
    });

    it('should skip undefined values', async () => {
      await saveFeishuSettings({
        lark_app_id: 'new_app_id',
        lark_app_secret: undefined,
      });

      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('getLLMSettings', () => {
    it('should return LLM settings', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { key: 'llm_provider', value: 'anthropic' },
        { key: 'mock_llm', value: 'true' },
      ]);

      const result = await getLLMSettings();

      expect(result.llm_provider).toBe('anthropic');
      expect(result.mock_llm).toBe(true);
    });

    it('should parse mock_llm correctly', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { key: 'mock_llm', value: 'false' },
      ]);

      const result = await getLLMSettings();

      expect(result.mock_llm).toBe(false);
    });
  });

  describe('saveLLMSettings', () => {
    it('should save LLM settings', async () => {
      await saveLLMSettings({
        llm_provider: 'openai',
        mock_llm: true,
      });

      expect(query).toHaveBeenCalled();
    });
  });
});
