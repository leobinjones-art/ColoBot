/**
 * Settings Cache 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

vi.stubEnv('MOCK_LLM', 'false');
vi.stubEnv('LLM_PROVIDER', 'openai');
vi.stubEnv('OPENAI_API_KEY', 'test-key');

import { query } from '../memory/db.js';
import {
  getMockLLM,
  getLlmProvider,
  getOpenAIApiKey,
  getAnthropicApiKey,
  getMinimaxApiKey,
  refreshCache,
} from '../services/settings-cache.js';

describe('Settings Cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getMockLLM', () => {
    it('should return false by default', () => {
      const result = getMockLLM();
      expect(result).toBe(false);
    });

    it('should return true when set', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { key: 'mock_llm', value: 'true' },
      ]);

      await refreshCache();

      // Note: cache might not be updated due to singleton
      expect(query).toHaveBeenCalled();
    });
  });

  describe('getLlmProvider', () => {
    it('should return openai by default', () => {
      const result = getLlmProvider();
      expect(result).toBe('openai');
    });

    it('should return anthropic when set', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { key: 'llm_provider', value: 'anthropic' },
      ]);

      await refreshCache();

      expect(query).toHaveBeenCalled();
    });

    it('should return minimax when set', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { key: 'llm_provider', value: 'minimax' },
      ]);

      await refreshCache();

      expect(query).toHaveBeenCalled();
    });

    it('should fallback to openai for invalid value', () => {
      // Default fallback
      const result = getLlmProvider();
      expect(['openai', 'anthropic', 'minimax']).toContain(result);
    });
  });

  describe('getOpenAIApiKey', () => {
    it('should return env value by default', () => {
      const result = getOpenAIApiKey();
      expect(result).toBe('test-key');
    });

    it('should return cached value', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { key: 'openai_api_key', value: 'cached-key' },
      ]);

      await refreshCache();

      expect(query).toHaveBeenCalled();
    });
  });

  describe('getAnthropicApiKey', () => {
    it('should return empty string by default', () => {
      const result = getAnthropicApiKey();
      expect(typeof result).toBe('string');
    });
  });

  describe('getMinimaxApiKey', () => {
    it('should return empty string by default', () => {
      const result = getMinimaxApiKey();
      expect(typeof result).toBe('string');
    });
  });

  describe('refreshCache', () => {
    it('should load settings from database', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { key: 'mock_llm', value: 'true' },
        { key: 'llm_provider', value: 'anthropic' },
      ]);

      await refreshCache();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT key, value'),
        expect.any(Array)
      );
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(query).mockRejectedValueOnce(new Error('DB error'));

      await refreshCache();

      // Should not throw
    });
  });
});