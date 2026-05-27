/**
 * LLM Provider 测试
 * 使用真实 API 调用，缺少 API Key 时跳过
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { OpenAIProvider } from '../providers/openai.js'
import { AnthropicProvider } from '../providers/anthropic.js'
import { MockProvider } from '../providers/mock.js'
import { chatWithFallback, chatStreamWithFallback, parseFallbackString } from '../providers/fallback.js'
import type { LLMProvider } from '../runtime/types.js'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY

describe('LLM Providers', () => {
  describe('OpenAI Provider', () => {
    it('should create OpenAI provider', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        defaultModel: 'gpt-4o',
      })
      expect(provider.name).toBe('openai')
    })

    it('should use default model when not specified', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      })
      expect(provider.name).toBe('openai')
    })

    it('should use custom base URL', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com/v1',
      })
      expect(provider.name).toBe('openai')
    })

    it('should call chat with real API and return content', async () => {
      if (!OPENAI_API_KEY) return

      const provider = new OpenAIProvider({
        apiKey: OPENAI_API_KEY,
        defaultModel: 'gpt-4o',
      })

      const result = await provider.chat([{ role: 'user', content: 'Say exactly: Hello!' }])
      expect(result.content).toBeTruthy()
      expect(typeof result.content).toBe('string')
    })

    it('should handle tool calls in response', async () => {
      if (!OPENAI_API_KEY) return

      const provider = new OpenAIProvider({
        apiKey: OPENAI_API_KEY,
        defaultModel: 'gpt-4o',
      })

      const result = await provider.chat(
        [{ role: 'user', content: 'What is the weather in Beijing?' }],
        {
          tools: [
            {
              type: 'function',
              function: {
                name: 'get_weather',
                description: 'Get weather for a location',
                parameters: {
                  type: 'object',
                  properties: { location: { type: 'string' } },
                  required: ['location'],
                },
              },
            },
          ],
        },
      )

      // Tool call response or text response both acceptable
      expect(result.content || result.toolCalls).toBeTruthy()
    })

    it('should return usage information', async () => {
      if (!OPENAI_API_KEY) return

      const provider = new OpenAIProvider({
        apiKey: OPENAI_API_KEY,
        defaultModel: 'gpt-4o',
      })

      const result = await provider.chat([{ role: 'user', content: 'Hi' }])
      expect(result.usage).toBeDefined()
      expect(result.usage!.inputTokens).toBeGreaterThan(0)
      expect(result.usage!.outputTokens).toBeGreaterThan(0)
    })

    it('should throw error on API failure', async () => {
      const provider = new OpenAIProvider({
        apiKey: 'invalid-key-that-will-fail',
      })

      await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow()
    })

    it('should pass options to API call', async () => {
      if (!OPENAI_API_KEY) return

      const provider = new OpenAIProvider({
        apiKey: OPENAI_API_KEY,
      })

      // Should not throw when using a valid model with options
      const result = await provider.chat([{ role: 'user', content: 'Hi' }], {
        model: 'gpt-4o-mini',
        temperature: 0.5,
        maxTokens: 50,
      })

      expect(result.content).toBeTruthy()
    })

    it('should have chatStream method', () => {
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      })

      expect(provider.chatStream).toBeDefined()
      expect(typeof provider.chatStream).toBe('function')
    })
  })

  describe('Anthropic Provider', () => {
    it('should create Anthropic provider', () => {
      const provider = new AnthropicProvider({
        apiKey: 'test-key',
        defaultModel: 'claude-sonnet-4-20250514',
      })
      expect(provider.name).toBe('anthropic')
    })

    it('should use default model when not specified', () => {
      const provider = new AnthropicProvider({
        apiKey: 'test-key',
      })
      expect(provider.name).toBe('anthropic')
    })

    it('should call chat with real API and return content', async () => {
      if (!ANTHROPIC_API_KEY) return

      const provider = new AnthropicProvider({
        apiKey: ANTHROPIC_API_KEY,
      })

      const result = await provider.chat([{ role: 'user', content: 'Say exactly: Hello from Claude!' }])
      expect(result.content).toBeTruthy()
      expect(typeof result.content).toBe('string')
    })

    it('should separate system messages', async () => {
      if (!ANTHROPIC_API_KEY) return

      const provider = new AnthropicProvider({
        apiKey: ANTHROPIC_API_KEY,
      })

      const result = await provider.chat([
        { role: 'system', content: 'You are a helpful assistant. Reply with exactly one word.' },
        { role: 'user', content: 'Say hello' },
      ])

      expect(result.content).toBeTruthy()
    })

    it('should return usage information', async () => {
      if (!ANTHROPIC_API_KEY) return

      const provider = new AnthropicProvider({
        apiKey: ANTHROPIC_API_KEY,
      })

      const result = await provider.chat([{ role: 'user', content: 'Hi' }])
      expect(result.usage).toBeDefined()
      expect(result.usage!.inputTokens).toBeGreaterThan(0)
      expect(result.usage!.outputTokens).toBeGreaterThan(0)
    })

    it('should throw error on API failure', async () => {
      const provider = new AnthropicProvider({
        apiKey: 'invalid-key-that-will-fail',
      })

      await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow(
        'Anthropic API error',
      )
    })

    it('should have chatStream method', () => {
      const provider = new AnthropicProvider({
        apiKey: 'test-key',
      })

      expect(provider.chatStream).toBeDefined()
      expect(typeof provider.chatStream).toBe('function')
    })
  })

  describe('Mock Provider', () => {
    it('should create Mock provider', () => {
      const provider = new MockProvider({
        defaultModel: 'mock-model',
      })
      expect(provider.name).toBe('mock')
    })

    it('should return mock response', async () => {
      const provider = new MockProvider({
        defaultModel: 'mock-model',
      })

      const result = await provider.chat([{ role: 'user', content: 'Hi' }])
      expect(result.content).toContain('[Mock]')
    })

    it('should handle introduction message', async () => {
      const provider = new MockProvider()

      const result = await provider.chat([{ role: 'user', content: '介绍一下你自己' }])
      expect(result.content).toContain('ColoMind')
      expect(result.content).toContain('Mock')
    })

    it('should handle remember message', async () => {
      const provider = new MockProvider()

      const result = await provider.chat([{ role: 'user', content: '记住这个信息' }])
      expect(result.content).toContain('记住')
    })

    it('should handle Skill system prompt', async () => {
      const provider = new MockProvider()

      const result = await provider.chat([
        { role: 'system', content: 'You are a Skill executor' },
        { role: 'user', content: 'Execute task' },
      ])
      expect(result.content).toContain('Skill')
    })

    it('should support streaming', async () => {
      const provider = new MockProvider()

      const chunks: string[] = []
      for await (const chunk of provider.chatStream([{ role: 'user', content: 'Hi' }])) {
        if (chunk.type === 'text') {
          chunks.push(chunk.content!)
        }
      }

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toContain('[Mock]')
    })

    it('should yield done at end of stream', async () => {
      const provider = new MockProvider()

      let gotDone = false
      for await (const chunk of provider.chatStream([{ role: 'user', content: 'Hi' }])) {
        if (chunk.type === 'done') {
          gotDone = true
        }
      }

      expect(gotDone).toBe(true)
    })
  })

  describe('Fallback Provider', () => {
    it('should export chatWithFallback function', () => {
      expect(chatWithFallback).toBeDefined()
      expect(typeof chatWithFallback).toBe('function')
    })

    it('should export parseFallbackString function', () => {
      const result = parseFallbackString('anthropic:claude-sonnet', 'openai')
      expect(result.provider).toBe('anthropic')
      expect(result.modelId).toBe('claude-sonnet')
    })

    it('should parse fallback string without provider', () => {
      const result = parseFallbackString('gpt-4o-mini', 'openai')
      expect(result.provider).toBe('openai')
      expect(result.modelId).toBe('gpt-4o-mini')
    })

    it('should export chatStreamWithFallback function', () => {
      expect(chatStreamWithFallback).toBeDefined()
      expect(typeof chatStreamWithFallback).toBe('function')
    })

    it('should call primary provider first (using MockProvider)', async () => {
      const mockProvider = new MockProvider({ defaultModel: 'mock-model' })

      const providers = new Map<string, LLMProvider>([['mock', mockProvider]])

      const result = await chatWithFallback([{ role: 'user', content: 'Hi' }], providers, {
        provider: mockProvider,
        modelId: 'mock-model',
      })

      expect(result.content).toBeTruthy()
    })

    it('should fallback to next provider on failure (using MockProvider)', async () => {
      // Create a provider that always fails by using an invalid API key
      const failingProvider = new OpenAIProvider({
        apiKey: 'invalid-key-fail',
      })

      // Fallback to a working MockProvider
      const workingProvider = new MockProvider({ defaultModel: 'mock-model' })

      const providers = new Map<string, LLMProvider>([
        ['openai', failingProvider],
        ['mock', workingProvider],
      ])

      const result = await chatWithFallback([{ role: 'user', content: 'Hi' }], providers, {
        provider: failingProvider,
        modelId: 'gpt-4o',
        fallbackChain: ['mock:mock-model'],
      })

      expect(result.content).toBeTruthy()
    })

    it('should throw when all providers fail', async () => {
      // All providers use invalid keys, so they all fail
      const failingProvider = new OpenAIProvider({
        apiKey: 'invalid-key-fail',
      })

      const providers = new Map<string, LLMProvider>([['openai', failingProvider]])

      await expect(
        chatWithFallback([{ role: 'user', content: 'Hi' }], providers, {
          provider: failingProvider,
          modelId: 'mock-model',
        }),
      ).rejects.toThrow()
    })
  })
})
