/**
 * LLM Provider 测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock fetch
global.fetch = vi.fn()

describe('LLM Providers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('OpenAI Provider', () => {
    it('should create OpenAI provider', async () => {
      const { OpenAIProvider } = await import('../providers/openai.js')
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        defaultModel: 'gpt-4o',
      })
      expect(provider.name).toBe('openai')
    })

    it('should call chat with correct parameters', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Hello!' } }],
        }),
      } as Response)

      const { OpenAIProvider } = await import('../providers/openai.js')
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        defaultModel: 'gpt-4o',
      })

      const result = await provider.chat([{ role: 'user', content: 'Hi' }])
      expect(result.content).toBe('Hello!')
    })

    it('should handle streaming', async () => {
      const { OpenAIProvider } = await import('../providers/openai.js')
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        defaultModel: 'gpt-4o',
      })

      // 验证 chatStream 方法存在
      expect(provider.chatStream).toBeDefined()
    })
  })

  describe('Anthropic Provider', () => {
    it('should create Anthropic provider', async () => {
      const { AnthropicProvider } = await import('../providers/anthropic.js')
      const provider = new AnthropicProvider({
        apiKey: 'test-key',
        defaultModel: 'claude-sonnet-4-20250514',
      })
      expect(provider.name).toBe('anthropic')
    })
  })

  describe('Mock Provider', () => {
    it('should create Mock provider', async () => {
      const { MockProvider } = await import('../providers/mock.js')
      const provider = new MockProvider({
        defaultModel: 'mock-model',
      })
      expect(provider.name).toBe('mock')
    })

    it('should return mock response', async () => {
      const { MockProvider } = await import('../providers/mock.js')
      const provider = new MockProvider({
        defaultModel: 'mock-model',
      })

      const result = await provider.chat([{ role: 'user', content: 'Hi' }])
      expect(result.content).toContain('[Mock]')
    })
  })

  describe('Fallback Provider', () => {
    it('should export chatWithFallback function', async () => {
      const { chatWithFallback } = await import('../providers/fallback.js')
      expect(chatWithFallback).toBeDefined()
    })

    it('should export parseFallbackString function', async () => {
      const { parseFallbackString } = await import('../providers/fallback.js')
      const result = parseFallbackString('anthropic:claude-sonnet', 'openai')
      expect(result.provider).toBe('anthropic')
      expect(result.modelId).toBe('claude-sonnet')
    })
  })
})
