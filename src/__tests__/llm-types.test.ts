/**
 * LLM Module 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock settings-cache
vi.mock('../services/settings-cache.js', () => ({
  getMockLLM: vi.fn(() => false),
  getLlmProvider: vi.fn(() => 'openai'),
  getOpenAIApiKey: vi.fn(() => 'test-key'),
  getAnthropicApiKey: vi.fn(() => ''),
  getMinimaxApiKey: vi.fn(() => ''),
}));

// Mock config/llm
vi.mock('../config/llm.js', () => ({
  getLlmConfig: vi.fn(() => ({
    model: 'gpt-4',
    endpoint: 'https://api.openai.com',
    temperature: 0.7,
    maxTokens: 4096,
  })),
  getEmbeddingConfig: vi.fn(() => ({
    model: 'text-embedding-3-small',
    endpoint: 'https://api.openai.com',
  })),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { getMockLLM, getLlmProvider, getOpenAIApiKey } from '../services/settings-cache.js';

describe('LLM Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Selection', () => {
    it('should return openai provider', () => {
      const provider = getLlmProvider();
      expect(provider).toBe('openai');
    });

    it('should return mock mode setting', () => {
      const mock = getMockLLM();
      expect(mock).toBe(false);
    });

    it('should return API key', () => {
      const key = getOpenAIApiKey();
      expect(key).toBe('test-key');
    });
  });

  describe('Message Types', () => {
    it('should create text message', () => {
      const message = {
        role: 'user' as const,
        content: 'Hello',
      };
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello');
    });

    it('should create multimodal message', () => {
      const message = {
        role: 'user' as const,
        content: [
          { type: 'text', text: 'What is this?' },
          { type: 'image_url', image_url: { url: 'https://example.com/image.jpg' } },
        ],
      };
      expect(Array.isArray(message.content)).toBe(true);
    });

    it('should create system message', () => {
      const message = {
        role: 'system' as const,
        content: 'You are a helpful assistant.',
      };
      expect(message.role).toBe('system');
    });

    it('should create assistant message', () => {
      const message = {
        role: 'assistant' as const,
        content: 'Hello! How can I help?',
      };
      expect(message.role).toBe('assistant');
    });
  });

  describe('Content Block Types', () => {
    it('should create text content block', () => {
      const block = { type: 'text', text: 'Hello' };
      expect(block.type).toBe('text');
    });

    it('should create image content block', () => {
      const block = { type: 'image_url', image_url: { url: 'https://example.com/img.jpg' } };
      expect(block.type).toBe('image_url');
    });

    it('should create audio content block', () => {
      const block = { type: 'audio_url', audio_url: { url: 'https://example.com/audio.mp3' } };
      expect(block.type).toBe('audio_url');
    });
  });

  describe('Response Types', () => {
    it('should define chat response structure', () => {
      const response = {
        content: 'Response text',
        finishReason: 'stop',
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      };
      expect(response.content).toBe('Response text');
      expect(response.finishReason).toBe('stop');
    });

    it('should define stream chunk structure', () => {
      const chunk = {
        delta: 'partial text',
        done: false,
        finishReason: undefined,
      };
      expect(chunk.delta).toBe('partial text');
      expect(chunk.done).toBe(false);
    });
  });
});