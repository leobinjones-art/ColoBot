/**
 * 接管信号
 *
 * 母 Agent → 父 Agent 的强制终止/恢复信号
 */

// ═══════════════════════════════════════════════════════════════
// 信号类型定义
// ═══════════════════════════════════════════════════════════════

export type TakeoverReason = 'timeout' | 'input_blocked' | 'output_blocked' | 'parent_unresponsive' | 'rate_limit'
export type TakeoverAction = 'suspend' | 'terminate'

export interface TakeoverSignal {
  type: 'takeover'
  sessionId: string
  reason: TakeoverReason
  action: TakeoverAction
  timestamp: number
  message?: string
}

export interface ResumeSignal {
  type: 'resume'
  sessionId: string
  timestamp: number
}

export interface AckSignal {
  type: 'ack'
  sessionId: string
  signalType: 'takeover' | 'resume'
  timestamp: number
}

// ═══════════════════════════════════════════════════════════════
// 信号总线（内存模式）
// ═══════════════════════════════════════════════════════════════

type SignalHandler = (signal: TakeoverSignal | ResumeSignal) => void

export class SignalBus {
  private handlers: Map<string, SignalHandler[]> = new Map()
  private pendingSignals: Map<string, TakeoverSignal | ResumeSignal> = new Map()

  /**
   * 订阅信号
   */
  subscribe(agentId: string, handler: SignalHandler): () => void {
    if (!this.handlers.has(agentId)) {
      this.handlers.set(agentId, [])
    }
    this.handlers.get(agentId)!.push(handler)

    // 返回取消订阅函数
    return () => {
      const handlers = this.handlers.get(agentId)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index >= 0) {
          handlers.splice(index, 1)
        }
      }
    }
  }

  /**
   * 发送接管信号
   */
  sendTakeover(signal: TakeoverSignal): void {
    this.pendingSignals.set(signal.sessionId, signal)
    this.notifyHandlers(signal)
  }

  /**
   * 发送恢复信号
   */
  sendResume(signal: ResumeSignal): void {
    this.pendingSignals.set(signal.sessionId, signal)
    this.notifyHandlers(signal)
  }

  /**
   * 发送确认信号
   */
  sendAck(ack: AckSignal): void {
    // 清除待处理信号
    const pending = this.pendingSignals.get(ack.sessionId)
    if (pending && pending.type === ack.signalType) {
      this.pendingSignals.delete(ack.sessionId)
    }
  }

  /**
   * 通知处理器
   */
  private notifyHandlers(signal: TakeoverSignal | ResumeSignal): void {
    // 通知所有订阅者
    for (const handlers of this.handlers.values()) {
      for (const handler of handlers) {
        try {
          handler(signal)
        } catch (e) {
          console.error('[SignalBus] Handler error:', e)
        }
      }
    }
  }

  /**
   * 获取待处理信号
   */
  getPending(sessionId: string): TakeoverSignal | ResumeSignal | undefined {
    return this.pendingSignals.get(sessionId)
  }

  /**
   * 清空待处理信号
   */
  clear(): void {
    this.pendingSignals.clear()
  }
}

// ═══════════════════════════════════════════════════════════════
// 接管管理器（母 Agent 侧）
// ═══════════════════════════════════════════════════════════════

export class TakeoverManager {
  private bus: SignalBus
  private onTakeover?: (signal: TakeoverSignal) => string  // 返回接管话术
  private onResume?: (signal: ResumeSignal) => void

  constructor(bus: SignalBus) {
    this.bus = bus
  }

  /**
   * 设置接管回调
   */
  setOnTakeover(callback: (signal: TakeoverSignal) => string): void {
    this.onTakeover = callback
  }

  /**
   * 设置恢复回调
   */
  setOnResume(callback: (signal: ResumeSignal) => void): void {
    this.onResume = callback
  }

  /**
   * 触发接管
   */
  trigger(sessionId: string, reason: TakeoverReason, action: TakeoverAction = 'terminate'): string {
    const signal: TakeoverSignal = {
      type: 'takeover',
      sessionId,
      reason,
      action,
      timestamp: Date.now(),
    }

    this.bus.sendTakeover(signal)

    // 生成接管话术
    if (this.onTakeover) {
      return this.onTakeover(signal)
    }

    return this.getDefaultMessage(reason)
  }

  /**
   * 触发恢复
   */
  resume(sessionId: string): void {
    const signal: ResumeSignal = {
      type: 'resume',
      sessionId,
      timestamp: Date.now(),
    }

    this.bus.sendResume(signal)

    if (this.onResume) {
      this.onResume(signal)
    }
  }

  /**
   * 默认接管话术
   */
  private getDefaultMessage(reason: TakeoverReason): string {
    const messages: Record<TakeoverReason, string> = {
      timeout: '任务执行时间过长，已为您终止。您可以稍后重试或简化任务。',
      input_blocked: '您的输入包含不合规内容，请重新描述您的需求。',
      output_blocked: '生成的内容需要调整，请稍后重试。',
      parent_unresponsive: '系统遇到问题，正在恢复中，请稍后重试。',
      rate_limit: '您的请求过于频繁，请稍后再试。',
    }
    return messages[reason]
  }
}

// ═══════════════════════════════════════════════════════════════
// 信号接收器（父 Agent 侧）
// ═══════════════════════════════════════════════════════════════

export interface SignalReceiverCallbacks {
  onTakeover?: (signal: TakeoverSignal) => void
  onResume?: (signal: ResumeSignal) => void
}

export class SignalReceiver {
  private bus: SignalBus
  private agentId: string
  private unsubscribe?: () => void

  constructor(bus: SignalBus, agentId: string) {
    this.bus = bus
    this.agentId = agentId
  }

  /**
   * 开始监听
   */
  start(callbacks: SignalReceiverCallbacks): void {
    this.unsubscribe = this.bus.subscribe(this.agentId, (signal) => {
      if (signal.type === 'takeover' && callbacks.onTakeover) {
        callbacks.onTakeover(signal)
      } else if (signal.type === 'resume' && callbacks.onResume) {
        callbacks.onResume(signal)
      }

      // 发送确认
      this.bus.sendAck({
        type: 'ack',
        sessionId: signal.sessionId,
        signalType: signal.type,
        timestamp: Date.now(),
      })
    })
  }

  /**
   * 停止监听
   */
  stop(): void {
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = undefined
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultBus: SignalBus | null = null

export function getSignalBus(): SignalBus {
  if (!defaultBus) {
    defaultBus = new SignalBus()
  }
  return defaultBus
}

export function resetSignalBus(): SignalBus {
  defaultBus = new SignalBus()
  return defaultBus
}
