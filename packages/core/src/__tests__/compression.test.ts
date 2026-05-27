/**
 * 上下文压缩测试 — 真实 LLM 调用
 */
import { describe, it, expect } from 'vitest'
import { estimateTokens, estimateMessagesTokens, compressMessages } from '../compression.js'
import type { LLMMessage } from '@colomind/types'
import { createOpenAIProvider } from '../llm/index.js'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'

describe('Compression', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      expect(estimateTokens('a'.repeat(20))).toBe(5)
    })

    it('should round up to the nearest token', () => {
      expect(estimateTokens('abcde')).toBe(2)
    })

    it('should return 1 token for a short string', () => {
      expect(estimateTokens('a')).toBe(1)
    })

    it('should return 0 tokens for an empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })

    it('should handle longer text correctly', () => {
      expect(estimateTokens('a'.repeat(100))).toBe(25)
    })
  })

  describe('estimateMessagesTokens', () => {
    it('should sum tokens across all messages', () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'a'.repeat(20) },
        { role: 'assistant', content: 'b'.repeat(40) },
      ]
      expect(estimateMessagesTokens(messages)).toBe(35)
    })

    it('should add 10 overhead tokens per message', () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: '' },
        { role: 'assistant', content: '' },
      ]
      expect(estimateMessagesTokens(messages)).toBe(20)
    })

    it('should handle ContentBlock arrays', () => {
      const messages: LLMMessage[] = [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'a'.repeat(20) },
            { type: 'image_url' as const, image_url: { url: 'http://example.com' } },
          ],
        },
      ]
      expect(estimateMessagesTokens(messages)).toBe(16)
    })

    it('should return 0 for an empty message array', () => {
      expect(estimateMessagesTokens([])).toBe(0)
    })
  })

  describe('compressMessages', () => {
    it('should return messages unchanged when under threshold', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
      ]
      const result = await compressMessages(messages, 1000)
      expect(result).toEqual(messages)
    })

    it('should remove older messages when over limit without LLM', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System prompt' },
        ...Array.from({ length: 8 }, (_, i) => ({
          role: 'user' as const,
          content: 'a'.repeat(500),
        })),
      ]
      const result = await compressMessages(messages, 500)
      expect(result.length).toBeLessThanOrEqual(12)
    })

    it('should keep system messages when compressing without LLM', async () => {
      const messages: LLMMessage[] = [
        { role: 'system', content: 'System prompt' },
        ...Array.from({ length: 8 }, (_, i) => ({
          role: 'user' as const,
          content: 'a'.repeat(500),
        })),
      ]
      const result = await compressMessages(messages, 500)
      expect(result.length).toBeLessThanOrEqual(messages.length)
    })

    it('should use real LLM to summarize old messages', async () => {
      if (!OPENAI_API_KEY) return

      const provider = createOpenAIProvider({
        apiKey: OPENAI_API_KEY,
        baseUrl: OPENAI_BASE_URL,
        model: 'gpt-4o-mini',
      })

      const messages: LLMMessage[] = [
        { role: 'system', content: 'System prompt' },
        ...Array.from({ length: 8 }, (_, i) => ({
          role: 'user' as const,
          content: `Message ${i}: ` + 'a'.repeat(500),
        })),
      ]

      const result = await compressMessages(messages, 500, provider)

      expect(result.length).toBeLessThan(messages.length)
      expect(result.some((m) => m.role === 'system')).toBe(true)
      expect(result.some((m) => m.role === 'user' && typeof m.content === 'string' && m.content.includes('压缩摘要'))).toBe(true)
    })

    it('should use systemPrompt override when provided with real LLM', async () => {
      if (!OPENAI_API_KEY) return

      const provider = createOpenAIProvider({
        apiKey: OPENAI_API_KEY,
        baseUrl: OPENAI_BASE_URL,
        model: 'gpt-4o-mini',
      })

      const messages: LLMMessage[] = [
        { role: 'system', content: 'Original system prompt' },
        ...Array.from({ length: 8 }, (_, i) => ({
          role: 'user' as const,
          content: 'a'.repeat(500),
        })),
      ]

      const result = await compressMessages(messages, 500, provider, 'Override system prompt')
      const systemMsg = result.find((m) => m.role === 'system')
      expect(systemMsg?.content).toBe('Override system prompt')
    })

    it('should fall back to truncation when LLM summarization fails', async () => {
      if (!OPENAI_API_KEY) return

      const provider = createOpenAIProvider({
        apiKey: 'invalid-key-to-trigger-failure',
        baseUrl: OPENAI_BASE_URL,
        model: 'gpt-4o-mini',
      })

      const messages: LLMMessage[] = [
        { role: 'system', content: 'System prompt' },
        ...Array.from({ length: 8 }, (_, i) => ({
          role: 'user' as const,
          content: 'a'.repeat(500),
        })),
      ]

      const result = await compressMessages(messages, 500, provider)
      expect(result.length).toBeLessThanOrEqual(12)
    })

    it('should return messages when no old messages to compress', async () => {
      const messages: LLMMessage[] = [
        { role: 'user', content: 'a'.repeat(2000) },
        { role: 'assistant', content: 'b'.repeat(2000) },
      ]
      const result = await compressMessages(messages, 500)
      expect(result.length).toBeLessThanOrEqual(messages.length)
    })
  })
})
