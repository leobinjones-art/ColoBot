/**
 * LLM 接管回复生成器
 *
 * 在接管时调用 LLM 生成自然的替代回复
 * 引导用户转向合规话题
 * 失败时使用预置静态话术兜底
 */

import type { TakeoverReason } from './signal.js'
import type { FallbackType } from './fallback.js'
import { getFallbackMessages } from './fallback.js'

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface LLMTakeoverConfig {
  enabled: boolean
  timeout: number // 超时时间（毫秒）
  maxRetries: number
}

const DEFAULT_CONFIG: LLMTakeoverConfig = {
  enabled: true,
  timeout: 5000,
  maxRetries: 1,
}

export interface TakeoverContext {
  sessionId: string
  reason: TakeoverReason
  lastUserMessage?: string
  currentTask?: string
  agentId?: string
}

/**
 * LLM 接管回复生成器接口
 */
export interface ILLMTakeoverGenerator {
  generate(context: TakeoverContext): Promise<string>
}

// ═══════════════════════════════════════════════════════════════
// LLM 接管回复生成器
// ═══════════════════════════════════════════════════════════════

/**
 * LLM 接管回复生成器
 *
 * 使用 LLM 生成自然的接管回复
 */
export class LLMTakeoverGenerator implements ILLMTakeoverGenerator {
  private config: LLMTakeoverConfig
  private llmClient?: {
    chat: (messages: Array<{ role: string; content: string }>) => Promise<string>
  }

  constructor(
    config?: Partial<LLMTakeoverConfig>,
    llmClient?: {
      chat: (messages: Array<{ role: string; content: string }>) => Promise<string>
    },
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.llmClient = llmClient
  }

  /**
   * 设置 LLM 客户端
   */
  setLLMClient(client: {
    chat: (messages: Array<{ role: string; content: string }>) => Promise<string>
  }): void {
    this.llmClient = client
  }

  /**
   * 生成接管回复
   */
  async generate(context: TakeoverContext): Promise<string> {
    if (!this.config.enabled || !this.llmClient) {
      return this.getFallbackMessage(context)
    }

    try {
      const prompt = this.buildPrompt(context)
      const response = await this.llmClient.chat([
        { role: 'system', content: this.getSystemPrompt() },
        { role: 'user', content: prompt },
      ])

      return response || this.getFallbackMessage(context)
    } catch (error) {
      console.warn('[LLMTakeoverGenerator] LLM call failed:', error)
      return this.getFallbackMessage(context)
    }
  }

  /**
   * 构建系统提示
   */
  private getSystemPrompt(): string {
    return `你是一个友好的客服助手，当系统遇到问题时，你需要生成一段自然的回复来安抚用户。

要求：
1. 语气友好、专业
2. 简要说明情况，不要过于技术化
3. 提供可行的后续建议
4. 不要超过 100 字

回复风格示例：
- "抱歉，处理您的请求时遇到了一些问题，请稍后重试或换个方式提问。"
- "您的请求需要更多时间处理，您可以继续等待，或者先处理其他事情。"`
  }

  /**
   * 构建用户提示
   */
  private buildPrompt(context: TakeoverContext): string {
    const reasonDesc = this.getReasonDescription(context.reason)
    const parts = [`情况：${reasonDesc}`]

    if (context.lastUserMessage) {
      parts.push(`用户最后的问题："${context.lastUserMessage.slice(0, 100)}"`)
    }

    if (context.currentTask) {
      parts.push(`正在执行的任务：${context.currentTask}`)
    }

    parts.push('请生成一段友好的回复：')

    return parts.join('\n')
  }

  /**
   * 获取原因描述
   */
  private getReasonDescription(reason: TakeoverReason): string {
    switch (reason) {
      case 'timeout':
        return '任务执行时间过长'
      case 'parent_unresponsive':
        return '系统暂时无响应'
      case 'output_blocked':
        return '检测到安全风险'
      case 'input_blocked':
        return '输入内容不合规'
      case 'rate_limit':
        return '请求过于频繁'
      default:
        return '系统遇到问题'
    }
  }

  /**
   * 获取兜底消息
   */
  private getFallbackMessage(context: TakeoverContext): string {
    const fallbacks = getFallbackMessages()
    const type = this.mapReasonToFallbackType(context.reason)
    return fallbacks.get(type)
  }

  /**
   * 映射原因到兜底类型
   */
  private mapReasonToFallbackType(reason: TakeoverReason): FallbackType {
    switch (reason) {
      case 'timeout':
        return 'timeout'
      case 'parent_unresponsive':
        return 'agent_crash'
      case 'output_blocked':
        return 'output_blocked'
      case 'input_blocked':
        return 'input_blocked'
      case 'rate_limit':
        return 'rate_limit'
      default:
        return 'unknown_error'
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// Mock LLM 生成器（测试用）
// ═══════════════════════════════════════════════════════════════

/**
 * Mock LLM 生成器
 *
 * 用于测试，返回固定的回复
 */
export class MockLLMGenerator implements ILLMTakeoverGenerator {
  async generate(context: TakeoverContext): Promise<string> {
    const reasonDesc = this.getReasonDescription(context.reason)

    if (context.lastUserMessage) {
      return `抱歉，${reasonDesc}。我们已记录您的需求"${context.lastUserMessage.slice(0, 50)}"，请稍后重试或换个方式提问。`
    }

    return `抱歉，${reasonDesc}，请稍后重试。`
  }

  private getReasonDescription(reason: TakeoverReason): string {
    switch (reason) {
      case 'timeout':
        return '任务执行时间过长'
      case 'parent_unresponsive':
        return '系统暂时无响应'
      case 'output_blocked':
        return '检测到安全风险'
      case 'input_blocked':
        return '输入内容不合规'
      case 'rate_limit':
        return '请求过于频繁'
      default:
        return '系统遇到问题'
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 接管回复管理器
// ═══════════════════════════════════════════════════════════════

/**
 * 接管回复管理器
 *
 * 自动选择 LLM 或兜底方案
 */
export class TakeoverMessageManager {
  private generator: ILLMTakeoverGenerator
  private fallbackGenerator: MockLLMGenerator

  constructor(generator?: ILLMTakeoverGenerator) {
    this.fallbackGenerator = new MockLLMGenerator()
    this.generator = generator || this.fallbackGenerator
  }

  /**
   * 设置生成器
   */
  setGenerator(generator: ILLMTakeoverGenerator): void {
    this.generator = generator
  }

  /**
   * 生成接管回复
   */
  async generate(context: TakeoverContext): Promise<string> {
    try {
      return await this.generator.generate(context)
    } catch (error) {
      console.warn('[TakeoverMessageManager] Generator failed, using fallback:', error)
      return this.fallbackGenerator.generate(context)
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultManager: TakeoverMessageManager | null = null

export function getTakeoverMessageManager(
  generator?: ILLMTakeoverGenerator,
): TakeoverMessageManager {
  if (!defaultManager) {
    defaultManager = new TakeoverMessageManager(generator)
  }
  return defaultManager
}

export function resetTakeoverMessageManager(
  generator?: ILLMTakeoverGenerator,
): TakeoverMessageManager {
  defaultManager = new TakeoverMessageManager(generator)
  return defaultManager
}
