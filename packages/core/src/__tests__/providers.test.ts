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

    it('should use default model when not specified', async () => {
      const { OpenAIProvider } = await import('../providers/openai.js')
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      })
      expect(provider.name).toBe('openai')
    })

    it('should use custom base URL', async () => {
      const { OpenAIProvider } = await import('../providers/openai.js')
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com/v1',
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

    it('should handle tool calls in response', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call-123',
                function: {
                  name: 'get_weather',
                  arguments: '{"location": "Beijing"}',
                },
              }],
            },
          }],
        }),
      } as Response)

      const { OpenAIProvider } = await import('../providers/openai.js')
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      })

      const result = await provider.chat([{ role: 'user', content: 'Weather?' }])
      expect(result.toolCalls).toBeDefined()
      expect(result.toolCalls?.[0].name).toBe('get_weather')
    })

    it('should return usage information', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      } as Response)

      const { OpenAIProvider } = await import('../providers/openai.js')
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      })

      const result = await provider.chat([{ role: 'user', content: 'Hi' }])
      expect(result.usage).toBeDefined()
      expect(result.usage?.inputTokens).toBe(10)
      expect(result.usage?.outputTokens).toBe(5)
    })

    it('should throw error on API failure', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Rate limit exceeded',
      } as Response)

      const { OpenAIProvider } = await import('../providers/openai.js')
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      })

      await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('OpenAI API error')
    })

    it('should pass options to API call', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Response' } }],
        }),
      } as Response)

      const { OpenAIProvider } = await import('../providers/openai.js')
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      })

      await provider.chat(
        [{ role: 'user', content: 'Hi' }],
        { model: 'gpt-4o-mini', temperature: 0.5, maxTokens: 100 }
      )

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
      expect(callBody.model).toBe('gpt-4o-mini')
      expect(callBody.temperature).toBe(0.5)
      expect(callBody.max_tokens).toBe(100)
    })

    it('should have chatStream method', async () => {
      const { OpenAIProvider } = await import('../providers/openai.js')
      const provider = new OpenAIProvider({
        apiKey: 'test-key',
      })

      expect(provider.chatStream).toBeDefined()
      expect(typeof provider.chatStream).toBe('function')
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

    it('should use default model when not specified', async () => {
      const { AnthropicProvider } = await import('../providers/anthropic.js')
      const provider = new AnthropicProvider({
        apiKey: 'test-key',
      })
      expect(provider.name).toBe('anthropic')
    })

    it('should call chat with correct parameters', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Hello from Claude!' }],
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
      } as Response)

      const { AnthropicProvider } = await import('../providers/anthropic.js')
      const provider = new AnthropicProvider({
        apiKey: 'test-key',
      })

      const result = await provider.chat([{ role: 'user', content: 'Hi' }])
      expect(result.content).toBe('Hello from Claude!')
    })

    it('should separate system messages', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
        }),
      } as Response)

      const { AnthropicProvider } = await import('../providers/anthropic.js')
      const provider = new AnthropicProvider({
        apiKey: 'test-key',
      })

      await provider.chat([
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
      ])

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string)
      expect(callBody.system).toBe('You are helpful')
      expect(callBody.messages).toHaveLength(1)
      expect(callBody.messages[0].role).toBe('user')
    })

    it('should return usage information', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          content: [{ type: 'text', text: 'Response' }],
          usage: { input_tokens: 15, output_tokens: 8 },
        }),
      } as Response)

      const { AnthropicProvider } = await import('../providers/anthropic.js')
      const provider = new AnthropicProvider({
        apiKey: 'test-key',
      })

      const result = await provider.chat([{ role: 'user', content: 'Hi' }])
      expect(result.usage?.inputTokens).toBe(15)
      expect(result.usage?.outputTokens).toBe(8)
    })

    it('should throw error on API failure', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid API key',
      } as Response)

      const { AnthropicProvider } = await import('../providers/anthropic.js')
      const provider = new AnthropicProvider({
        apiKey: 'test-key',
      })

      await expect(provider.chat([{ role: 'user', content: 'Hi' }])).rejects.toThrow('Anthropic API error')
    })

    it('should have chatStream method', async () => {
      const { AnthropicProvider } = await import('../providers/anthropic.js')
      const provider = new AnthropicProvider({
        apiKey: 'test-key',
      })

      expect(provider.chatStream).toBeDefined()
      expect(typeof provider.chatStream).toBe('function')
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

    it('should handle introduction message', async () => {
      const { MockProvider } = await import('../providers/mock.js')
      const provider = new MockProvider()

      const result = await provider.chat([{ role: 'user', content: '介绍一下你自己' }])
      expect(result.content).toContain('ColoBot')
      expect(result.content).toContain('Mock')
    })

    it('should handle remember message', async () => {
      const { MockProvider } = await import('../providers/mock.js')
      const provider = new MockProvider()

      const result = await provider.chat([{ role: 'user', content: '记住这个信息' }])
      expect(result.content).toContain('记住')
    })

    it('should handle Skill system prompt', async () => {
      const { MockProvider } = await import('../providers/mock.js')
      const provider = new MockProvider()

      const result = await provider.chat([
        { role: 'system', content: 'You are a Skill executor' },
        { role: 'user', content: 'Execute task' },
      ])
      expect(result.content).toContain('Skill')
    })

    it('should support streaming', async () => {
      const { MockProvider } = await import('../providers/mock.js')
      const provider = new MockProvider()

      const chunks: string[] = []
      for await (const chunk of provider.chatStream([{ role: 'user', content: 'Hi' }])) {
        if (chunk.type === 'text') {
          chunks.push(chunk.content)
        }
      }

      expect(chunks.length).toBeGreaterThan(0)
      expect(chunks.join('')).toContain('[Mock]')
    })

    it('should yield done at end of stream', async () => {
      const { MockProvider } = await import('../providers/mock.js')
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
    it('should export chatWithFallback function', async () => {
      const { chatWithFallback } = await import('../providers/fallback.js')
      expect(chatWithFallback).toBeDefined()
      expect(typeof chatWithFallback).toBe('function')
    })

    it('should export parseFallbackString function', async () => {
      const { parseFallbackString } = await import('../providers/fallback.js')
      const result = parseFallbackString('anthropic:claude-sonnet', 'openai')
      expect(result.provider).toBe('anthropic')
      expect(result.modelId).toBe('claude-sonnet')
    })

    it('should parse fallback string without provider', async () => {
      const { parseFallbackString } = await import('../providers/fallback.js')
      const result = parseFallbackString('gpt-4o-mini', 'openai')
      expect(result.provider).toBe('openai')
      expect(result.modelId).toBe('gpt-4o-mini')
    })

    it('should export chatStreamWithFallback function', async () => {
      const { chatStreamWithFallback } = await import('../providers/fallback.js')
      expect(chatStreamWithFallback).toBeDefined()
      expect(typeof chatStreamWithFallback).toBe('function')
    })

    it('should call primary provider first', async () => {
      const { chatWithFallback } = await import('../providers/fallback.js')

      const mockProvider = {
        name: 'mock',
        chat: vi.fn(async () => ({ content: 'Success' })),
        chatStream: vi.fn(),
      }

      const providers = new Map([['mock', mockProvider as any]])

      const result = await chatWithFallback(
        [{ role: 'user', content: 'Hi' }],
        providers,
        { provider: mockProvider as any, modelId: 'mock-model' }
      )

      expect(result.content).toBe('Success')
      expect(mockProvider.chat).toHaveBeenCalledTimes(1)
    })

    it('should fallback to next provider on failure', async () => {
      const { chatWithFallback } = await import('../providers/fallback.js')

      const failingProvider = {
        name: 'failing',
        chat: vi.fn(async () => { throw new Error('API Error') }),
        chatStream: vi.fn(),
      }

      const workingProvider = {
        name: 'working',
        chat: vi.fn(async () => ({ content: 'Fallback success' })),
        chatStream: vi.fn(),
      }

      const providers = new Map([
        ['failing', failingProvider as any],
        ['working', workingProvider as any],
      ])

      const result = await chatWithFallback(
        [{ role: 'user', content: 'Hi' }],
        providers,
        {
          provider: failingProvider as any,
          modelId: 'fail-model',
          fallbackChain: ['working:work-model'],
        }
      )

      expect(result.content).toBe('Fallback success')
      expect(failingProvider.chat).toHaveBeenCalled()
      expect(workingProvider.chat).toHaveBeenCalled()
    })

    it('should throw when all providers fail', async () => {
      const { chatWithFallback } = await import('../providers/fallback.js')

      const failingProvider = {
        name: 'failing',
        chat: vi.fn(async () => { throw new Error('API Error') }),
        chatStream: vi.fn(),
      }

      const providers = new Map([['failing', failingProvider as any]])

      await expect(chatWithFallback(
        [{ role: 'user', content: 'Hi' }],
        providers,
        { provider: failingProvider as any, modelId: 'mock-model' }
      )).rejects.toThrow('API Error')
    })
  })
})
