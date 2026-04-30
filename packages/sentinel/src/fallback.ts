/**
 * 静态兜底话术
 *
 * 当 LLM 调用失败时使用的预置回复
 */

// ═══════════════════════════════════════════════════════════════
// 话术类型
// ═══════════════════════════════════════════════════════════════

export type FallbackType =
  | 'input_blocked'
  | 'output_blocked'
  | 'timeout'
  | 'agent_crash'
  | 'rate_limit'
  | 'system_busy'
  | 'unknown_error'

// ═══════════════════════════════════════════════════════════════
// 默认话术库
// ═══════════════════════════════════════════════════════════════

const DEFAULT_FALLBACKS: Record<FallbackType, string[]> = {
  input_blocked: [
    '您的输入包含不合规内容，请重新描述您的需求。',
    '检测到异常输入，请调整后重试。',
    '您的请求无法处理，请换一种方式表达。',
  ],

  output_blocked: ['生成的内容需要调整，请稍后重试。', '回复内容已拦截，请重新提问。'],

  timeout: [
    '任务执行时间过长，已为您终止。您可以稍后重试或简化任务。',
    '处理超时，请尝试分步骤完成您的需求。',
  ],

  agent_crash: [
    '系统遇到问题，正在恢复中，请稍后重试。',
    '服务暂时不可用，我们正在处理，请稍后再试。',
  ],

  rate_limit: ['您的请求过于频繁，请稍后再试。', '已达到请求限制，请等待一分钟后重试。'],

  system_busy: ['系统繁忙，请稍后重试。', '服务负载较高，请稍后再试。'],

  unknown_error: ['系统遇到未知错误，请稍后重试。', '处理您的请求时出现问题，请重试。'],
}

// ═══════════════════════════════════════════════════════════════
// 兜底话术管理器
// ═══════════════════════════════════════════════════════════════

export class FallbackMessages {
  private messages: Record<FallbackType, string[]>
  private counters: Map<FallbackType, number> = new Map()

  constructor(customMessages?: Partial<Record<FallbackType, string[]>>) {
    this.messages = {
      ...DEFAULT_FALLBACKS,
      ...customMessages,
    }
  }

  /**
   * 获取话术（轮询方式，避免重复）
   */
  get(type: FallbackType): string {
    const list = this.messages[type] ?? DEFAULT_FALLBACKS[type]
    const counter = this.counters.get(type) ?? 0
    const index = counter % list.length
    this.counters.set(type, counter + 1)
    return list[index] ?? list[0]
  }

  /**
   * 获取带上下文的话术
   */
  getWithContext(
    type: FallbackType,
    context?: {
      task?: string
      lastMessage?: string
      reason?: string
    },
  ): string {
    const base = this.get(type)

    if (!context) return base

    const parts: string[] = [base]

    if (context.task) {
      parts.push(`\n\n您的任务：${context.task.slice(0, 100)}`)
    }

    if (context.reason) {
      parts.push(`\n\n原因：${context.reason}`)
    }

    return parts.join('')
  }

  /**
   * 更新话术库
   */
  update(type: FallbackType, messages: string[]): void {
    this.messages[type] = messages
  }

  /**
   * 添加话术
   */
  add(type: FallbackType, message: string): void {
    if (!this.messages[type]) {
      this.messages[type] = []
    }
    this.messages[type].push(message)
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultFallbacks: FallbackMessages | null = null

export function getFallbackMessages(
  customMessages?: Partial<Record<FallbackType, string[]>>,
): FallbackMessages {
  if (!defaultFallbacks) {
    defaultFallbacks = new FallbackMessages(customMessages)
  }
  return defaultFallbacks
}

export function resetFallbackMessages(
  customMessages?: Partial<Record<FallbackType, string[]>>,
): FallbackMessages {
  defaultFallbacks = new FallbackMessages(customMessages)
  return defaultFallbacks
}
