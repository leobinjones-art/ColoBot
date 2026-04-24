/**
 * Settings Cache Extended 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

describe('Settings Cache Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('getLlmProvider', () => {
    it('should return default provider', async () => {
      const { getLlmProvider } = await import('../services/settings-cache.js');
      const provider = getLlmProvider();

      expect(['openai', 'anthropic', 'minimax']).toContain(provider);
    });
  });

  describe('getMockLLM', () => {
    it('should return boolean', async () => {
      const { getMockLLM } = await import('../services/settings-cache.js');
      const mock = getMockLLM();

      expect(typeof mock).toBe('boolean');
    });
  });

  describe('getOpenAIApiKey', () => {
    it('should return string or null', async () => {
      const { getOpenAIApiKey } = await import('../services/settings-cache.js');
      const key = getOpenAIApiKey();

      expect(key === null || typeof key === 'string').toBe(true);
    });
  });

  describe('getAnthropicApiKey', () => {
    it('should return string or null', async () => {
      const { getAnthropicApiKey } = await import('../services/settings-cache.js');
      const key = getAnthropicApiKey();

      expect(key === null || typeof key === 'string').toBe(true);
    });
  });

  describe('getMinimaxApiKey', () => {
    it('should return string or null', async () => {
      const { getMinimaxApiKey } = await import('../services/settings-cache.js');
      const key = getMinimaxApiKey();

      expect(key === null || typeof key === 'string').toBe(true);
    });
  });

  describe('getMessageWebhookUrl', () => {
    it('should return string', async () => {
      const { getMessageWebhookUrl } = await import('../services/settings-cache.js');
      const url = getMessageWebhookUrl();

      expect(typeof url === 'string').toBe(true);
    });
  });

  describe('getFeishuWebhookUrl', () => {
    it('should return string', async () => {
      const { getFeishuWebhookUrl } = await import('../services/settings-cache.js');
      const url = getFeishuWebhookUrl();

      expect(typeof url === 'string').toBe(true);
    });
  });
});
