/**
 * LLM Config 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('LLM Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('DEFAULT_LLM_CONFIG', () => {
    it('should have default values for all providers', async () => {
      const { DEFAULT_LLM_CONFIG } = await import('../config/llm.js');

      expect(DEFAULT_LLM_CONFIG.openai).toBeDefined();
      expect(DEFAULT_LLM_CONFIG.anthropic).toBeDefined();
      expect(DEFAULT_LLM_CONFIG.minimax).toBeDefined();
    });

    it('should have default model for OpenAI', async () => {
      const { DEFAULT_LLM_CONFIG } = await import('../config/llm.js');

      expect(DEFAULT_LLM_CONFIG.openai.defaultModel).toBeDefined();
      expect(DEFAULT_LLM_CONFIG.openai.apiEndpoint).toContain('openai.com');
    });

    it('should have default model for Anthropic', async () => {
      const { DEFAULT_LLM_CONFIG } = await import('../config/llm.js');

      expect(DEFAULT_LLM_CONFIG.anthropic.defaultModel).toBeDefined();
      expect(DEFAULT_LLM_CONFIG.anthropic.apiEndpoint).toContain('anthropic.com');
    });

    it('should have default model for MiniMax', async () => {
      const { DEFAULT_LLM_CONFIG } = await import('../config/llm.js');

      expect(DEFAULT_LLM_CONFIG.minimax.defaultModel).toBeDefined();
      expect(DEFAULT_LLM_CONFIG.minimax.apiEndpoint).toContain('minimaxi.com');
    });
  });

  describe('getDefaultModel', () => {
    it('should return default model for OpenAI', async () => {
      const { getDefaultModel } = await import('../config/llm.js');

      const model = getDefaultModel('openai');
      expect(typeof model).toBe('string');
      expect(model.length).toBeGreaterThan(0);
    });

    it('should return default model for Anthropic', async () => {
      const { getDefaultModel } = await import('../config/llm.js');

      const model = getDefaultModel('anthropic');
      expect(typeof model).toBe('string');
      expect(model.length).toBeGreaterThan(0);
    });

    it('should return default model for MiniMax', async () => {
      const { getDefaultModel } = await import('../config/llm.js');

      const model = getDefaultModel('minimax');
      expect(typeof model).toBe('string');
      expect(model.length).toBeGreaterThan(0);
    });
  });

  describe('getApiEndpoint', () => {
    it('should return API endpoint for OpenAI', async () => {
      const { getApiEndpoint } = await import('../config/llm.js');

      const endpoint = getApiEndpoint('openai');
      expect(endpoint).toContain('http');
    });

    it('should return API endpoint for Anthropic', async () => {
      const { getApiEndpoint } = await import('../config/llm.js');

      const endpoint = getApiEndpoint('anthropic');
      expect(endpoint).toContain('http');
    });

    it('should return API endpoint for MiniMax', async () => {
      const { getApiEndpoint } = await import('../config/llm.js');

      const endpoint = getApiEndpoint('minimax');
      expect(endpoint).toContain('http');
    });
  });

  describe('getEmbeddingConfig', () => {
    it('should return embedding config for OpenAI', async () => {
      const { getEmbeddingConfig } = await import('../config/llm.js');

      const config = getEmbeddingConfig('openai');
      expect(config).not.toBeNull();
      expect(config?.model).toBeDefined();
      expect(config?.endpoint).toBeDefined();
    });

    it('should return embedding config for MiniMax', async () => {
      const { getEmbeddingConfig } = await import('../config/llm.js');

      const config = getEmbeddingConfig('minimax');
      expect(config).not.toBeNull();
      expect(config?.model).toBeDefined();
      expect(config?.endpoint).toBeDefined();
    });
  });

  describe('Environment variable overrides', () => {
    it('should use OPENAI_DEFAULT_MODEL env var', async () => {
      process.env.OPENAI_DEFAULT_MODEL = 'gpt-4-turbo';

      const { getDefaultModel } = await import('../config/llm.js');
      const model = getDefaultModel('openai');

      expect(model).toBe('gpt-4-turbo');
    });

    it('should use ANTHROPIC_DEFAULT_MODEL env var', async () => {
      process.env.ANTHROPIC_DEFAULT_MODEL = 'claude-opus-4';

      const { getDefaultModel } = await import('../config/llm.js');
      const model = getDefaultModel('anthropic');

      expect(model).toBe('claude-opus-4');
    });
  });
});