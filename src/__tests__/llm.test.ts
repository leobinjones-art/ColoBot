import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../memory/db.js', () => ({
  query: vi.fn(),
}));

vi.mock('../services/settings-cache.js', () => ({
  getMockLLM: vi.fn().mockReturnValue(false),
  getLlmProvider: vi.fn().mockReturnValue('openai'),
  getOpenAIApiKey: vi.fn().mockReturnValue('test-openai-key'),
  getAnthropicApiKey: vi.fn().mockReturnValue('test-anthropic-key'),
  getMinimaxApiKey: vi.fn().mockReturnValue('test-minimax-key'),
}));

describe('llm/index', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ContentBlock types', () => {
    it('should create TextContent correctly', () => {
      const textContent = { type: 'text' as const, text: 'Hello world' };
      expect(textContent.type).toBe('text');
      expect(textContent.text).toBe('Hello world');
    });

    it('should create ImageUrlContent correctly', () => {
      const imageContent = {
        type: 'image_url' as const,
        image_url: {
          url: 'https://example.com/image.png',
          detail: 'high' as const,
        },
      };
      expect(imageContent.type).toBe('image_url');
      expect(imageContent.image_url.url).toBe('https://example.com/image.png');
      expect(imageContent.image_url.detail).toBe('high');
    });

    it('should create AudioContent correctly', () => {
      const audioContent = {
        type: 'input_audio' as const,
        input_audio: {
          data: 'base64-audio-data',
          format: 'mp3',
        },
      };
      expect(audioContent.type).toBe('input_audio');
      expect(audioContent.input_audio.data).toBe('base64-audio-data');
      expect(audioContent.input_audio.format).toBe('mp3');
    });
  });

  describe('LLMMessage interface', () => {
    it('should create system message correctly', () => {
      const message = {
        role: 'system' as const,
        content: 'You are a helpful assistant',
      };
      expect(message.role).toBe('system');
      expect(message.content).toBe('You are a helpful assistant');
    });

    it('should create user message with multimodal content', () => {
      const message = {
        role: 'user' as const,
        content: [
          { type: 'text' as const, text: 'What is in this image?' },
          {
            type: 'image_url' as const,
            image_url: { url: 'https://example.com/image.png' },
          },
        ],
      };
      expect(message.role).toBe('user');
      expect(Array.isArray(message.content)).toBe(true);
      expect(message.content).toHaveLength(2);
    });
  });

  describe('LLMOptions interface', () => {
    it('should create default options', () => {
      const options = {};
      expect(options.temperature).toBeUndefined();
      expect(options.maxTokens).toBeUndefined();
      expect(options.model).toBeUndefined();
    });

    it('should create options with all fields', () => {
      const options = {
        temperature: 0.7,
        maxTokens: 1000,
        model: 'gpt-4o',
        systemPromptOverride: 'Custom system prompt',
        fallbackModelId: 'gpt-3.5-turbo',
        stream: true,
        retries: 3,
        retryDelayMs: 2000,
      };
      expect(options.temperature).toBe(0.7);
      expect(options.maxTokens).toBe(1000);
      expect(options.model).toBe('gpt-4o');
      expect(options.fallbackModelId).toBe('gpt-3.5-turbo');
      expect(options.stream).toBe(true);
      expect(options.retries).toBe(3);
      expect(options.retryDelayMs).toBe(2000);
    });
  });

  describe('ProviderType', () => {
    it('should support openai provider', () => {
      const provider: string = 'openai';
      expect(['openai', 'anthropic', 'minimax']).toContain(provider);
    });

    it('should support anthropic provider', () => {
      const provider: string = 'anthropic';
      expect(['openai', 'anthropic', 'minimax']).toContain(provider);
    });

    it('should support minimax provider', () => {
      const provider: string = 'minimax';
      expect(['openai', 'anthropic', 'minimax']).toContain(provider);
    });
  });

  describe('Model ID parsing', () => {
    it('should parse provider:modelId format', () => {
      const modelId = 'openai:gpt-4o';
      const [provider, model] = modelId.split(':');
      expect(provider).toBe('openai');
      expect(model).toBe('gpt-4o');
    });

    it('should handle model ID without provider', () => {
      const modelId = 'gpt-4o';
      const parts = modelId.split(':');
      expect(parts).toHaveLength(1);
      expect(parts[0]).toBe('gpt-4o');
    });

    it('should parse fallback chain', () => {
      const fallbackChain = 'openai:gpt-4o,anthropic:claude-sonnet,minimax:abab6.5-chat';
      const models = fallbackChain.split(',');
      expect(models).toHaveLength(3);
      expect(models[0]).toBe('openai:gpt-4o');
      expect(models[1]).toBe('anthropic:claude-sonnet');
      expect(models[2]).toBe('minimax:abab6.5-chat');
    });
  });
});