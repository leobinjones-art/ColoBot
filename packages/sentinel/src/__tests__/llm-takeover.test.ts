/**
 * LLM 接管回复测试
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  MockLLMGenerator,
  LLMTakeoverGenerator,
  TakeoverMessageManager,
  getTakeoverMessageManager,
  resetTakeoverMessageManager,
} from '../llm-takeover.js'
import type { TakeoverContext } from '../llm-takeover.js'

describe('MockLLMGenerator', () => {
  let generator: MockLLMGenerator

  beforeEach(() => {
    generator = new MockLLMGenerator()
  })

  describe('generate', () => {
    it('should generate message for timeout', async () => {
      const context: TakeoverContext = {
        sessionId: 'session-1',
        reason: 'timeout',
      }
      const result = await generator.generate(context)
      expect(result).toContain('任务执行时间过长')
    })

    it('should generate message for parent_unresponsive', async () => {
      const context: TakeoverContext = {
        sessionId: 'session-1',
        reason: 'parent_unresponsive',
      }
      const result = await generator.generate(context)
      expect(result).toContain('系统暂时无响应')
    })

    it('should generate message with user message', async () => {
      const context: TakeoverContext = {
        sessionId: 'session-1',
        reason: 'timeout',
        lastUserMessage: '帮我查询天气',
      }
      const result = await generator.generate(context)
      expect(result).toContain('帮我查询天气')
    })

    it('should truncate long user message', async () => {
      const context: TakeoverContext = {
        sessionId: 'session-1',
        reason: 'timeout',
        lastUserMessage: 'a'.repeat(100),
      }
      const result = await generator.generate(context)
      expect(result.length).toBeLessThan(200)
    })
  })
})

describe('LLMTakeoverGenerator', () => {
  describe('generate', () => {
    it('should use fallback when LLM not configured', async () => {
      const generator = new LLMTakeoverGenerator({ enabled: false })
      const context: TakeoverContext = {
        sessionId: 'session-1',
        reason: 'timeout',
      }
      const result = await generator.generate(context)
      // 兜底消息可能是两种之一
      expect(result.length).toBeGreaterThan(10)
    })

    it('should use LLM when configured', async () => {
      const mockLLM = {
        chat: async () => '这是 LLM 生成的回复',
      }
      const generator = new LLMTakeoverGenerator({ enabled: true }, mockLLM)
      const context: TakeoverContext = {
        sessionId: 'session-1',
        reason: 'timeout',
      }
      const result = await generator.generate(context)
      expect(result).toBe('这是 LLM 生成的回复')
    })

    it('should fallback on LLM error', async () => {
      const mockLLM = {
        chat: async () => {
          throw new Error('LLM error')
        },
      }
      const generator = new LLMTakeoverGenerator({ enabled: true }, mockLLM)
      const context: TakeoverContext = {
        sessionId: 'session-1',
        reason: 'timeout',
      }
      const result = await generator.generate(context)
      // 兜底消息随机选择，检查长度
      expect(result.length).toBeGreaterThan(10)
    })
  })
})

describe('TakeoverMessageManager', () => {
  let manager: TakeoverMessageManager

  beforeEach(() => {
    manager = new TakeoverMessageManager()
  })

  describe('generate', () => {
    it('should generate message using default generator', async () => {
      const context: TakeoverContext = {
        sessionId: 'session-1',
        reason: 'timeout',
      }
      const result = await manager.generate(context)
      expect(result).toBeDefined()
      expect(result.length).toBeGreaterThan(0)
    })

    it('should use custom generator', async () => {
      const customGenerator = {
        generate: async () => 'Custom message',
      }
      manager.setGenerator(customGenerator)

      const context: TakeoverContext = {
        sessionId: 'session-1',
        reason: 'timeout',
      }
      const result = await manager.generate(context)
      expect(result).toBe('Custom message')
    })

    it('should fallback on generator error', async () => {
      const errorGenerator = {
        generate: async () => {
          throw new Error('Generator error')
        },
      }
      manager.setGenerator(errorGenerator)

      const context: TakeoverContext = {
        sessionId: 'session-1',
        reason: 'timeout',
      }
      const result = await manager.generate(context)
      expect(result).toBeDefined()
    })
  })
})

describe('getTakeoverMessageManager', () => {
  beforeEach(() => {
    resetTakeoverMessageManager()
  })

  it('should return singleton instance', () => {
    const manager1 = getTakeoverMessageManager()
    const manager2 = getTakeoverMessageManager()
    expect(manager1).toBe(manager2)
  })

  it('should create new instance on reset', () => {
    const manager1 = getTakeoverMessageManager()
    const manager2 = resetTakeoverMessageManager()
    expect(manager1).not.toBe(manager2)
  })
})