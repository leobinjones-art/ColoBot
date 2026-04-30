/**
 * Redis Pub/Sub 信号总线
 *
 * 分布式信号通信，支持跨进程的 TakeoverSignal 和 ResumeSignal
 */

import type { IRedisClient } from './redis-store.js'
import type { TakeoverSignal, ResumeSignal, AckSignal } from './signal.js'

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface RedisSignalBusConfig {
  channelPrefix?: string
}

const DEFAULT_CONFIG: RedisSignalBusConfig = {
  channelPrefix: 'colobot:signal:',
}

// 信号类型
type SignalType = 'takeover' | 'resume' | 'ack'

// ═══════════════════════════════════════════════════════════════
// Redis 信号总线
// ═══════════════════════════════════════════════════════════════

/**
 * Redis 信号总线
 *
 * 使用 Redis Pub/Sub 实现跨进程信号通信
 */
export class RedisSignalBus {
  private client: IRedisClient
  private config: RedisSignalBusConfig
  private handlers: Map<string, Set<(signal: unknown) => void>> = new Map()

  constructor(client: IRedisClient, config?: Partial<RedisSignalBusConfig>) {
    this.client = client
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 发布接管信号
   */
  async publishTakeover(signal: TakeoverSignal): Promise<void> {
    const channel = this.getChannel('takeover')
    await this.client.publish(channel, JSON.stringify(signal))
  }

  /**
   * 发布恢复信号
   */
  async publishResume(signal: ResumeSignal): Promise<void> {
    const channel = this.getChannel('resume')
    await this.client.publish(channel, JSON.stringify(signal))
  }

  /**
   * 发布确认信号
   */
  async publishAck(signal: AckSignal): Promise<void> {
    const channel = this.getChannel('ack')
    await this.client.publish(channel, JSON.stringify(signal))
  }

  /**
   * 订阅接管信号
   */
  async subscribeTakeover(handler: (signal: TakeoverSignal) => void): Promise<void> {
    await this.subscribe('takeover', handler)
  }

  /**
   * 订阅恢复信号
   */
  async subscribeResume(handler: (signal: ResumeSignal) => void): Promise<void> {
    await this.subscribe('resume', handler)
  }

  /**
   * 订阅确认信号
   */
  async subscribeAck(handler: (signal: AckSignal) => void): Promise<void> {
    await this.subscribe('ack', handler)
  }

  /**
   * 取消订阅
   */
  async unsubscribe(type: SignalType): Promise<void> {
    const channel = this.getChannel(type)
    await this.client.unsubscribe(channel)
    this.handlers.delete(channel)
  }

  /**
   * 取消所有订阅
   */
  async unsubscribeAll(): Promise<void> {
    for (const type of ['takeover', 'resume', 'ack'] as SignalType[]) {
      await this.unsubscribe(type)
    }
  }

  // ─── 内部方法 ────────────────────────────────────────────────

  private getChannel(type: SignalType): string {
    return `${this.config.channelPrefix}${type}`
  }

  private async subscribe<T>(type: SignalType, handler: (signal: T) => void): Promise<void> {
    const channel = this.getChannel(type)

    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set())

      // 订阅 Redis 频道
      await this.client.subscribe(channel, (message: string) => {
        try {
          const signal = JSON.parse(message) as T
          const handlers = this.handlers.get(channel)
          if (handlers) {
            handlers.forEach((h) => h(signal))
          }
        } catch (error) {
          console.error(`[RedisSignalBus] Failed to parse signal:`, error)
        }
      })
    }

    this.handlers.get(channel)!.add(handler as (signal: unknown) => void)
  }
}

// ═══════════════════════════════════════════════════════════════
// Redis 接管管理器
// ═══════════════════════════════════════════════════════════════

/**
 * Redis 接管管理器
 *
 * 分布式版本的 TakeoverManager
 */
export class RedisTakeoverManager {
  private signalBus: RedisSignalBus
  private onTakeover?: (signal: TakeoverSignal) => string

  constructor(signalBus: RedisSignalBus) {
    this.signalBus = signalBus
  }

  /**
   * 设置接管回调
   */
  setOnTakeover(callback: (signal: TakeoverSignal) => string): void {
    this.onTakeover = callback
  }

  /**
   * 触发接管
   */
  async trigger(sessionId: string, reason: TakeoverSignal['reason']): Promise<string> {
    const signal: TakeoverSignal = {
      type: 'takeover',
      sessionId,
      reason,
      action: 'terminate',
      timestamp: Date.now(),
    }

    await this.signalBus.publishTakeover(signal)

    if (this.onTakeover) {
      return this.onTakeover(signal)
    }

    return `Takeover triggered for session ${sessionId}`
  }

  /**
   * 开始监听
   */
  async startListening(): Promise<void> {
    await this.signalBus.subscribeTakeover((signal) => {
      if (this.onTakeover) {
        this.onTakeover(signal)
      }
    })
  }

  /**
   * 停止监听
   */
  async stopListening(): Promise<void> {
    await this.signalBus.unsubscribe('takeover')
  }
}

// ═══════════════════════════════════════════════════════════════
// Redis 信号接收器
// ═══════════════════════════════════════════════════════════════

/**
 * Redis 信号接收器
 *
 * 分布式版本的 SignalReceiver
 */
export class RedisSignalReceiver {
  private signalBus: RedisSignalBus
  private agentId: string
  private handlers: Map<string, (signal: unknown) => void> = new Map()

  constructor(signalBus: RedisSignalBus, agentId: string) {
    this.signalBus = signalBus
    this.agentId = agentId
  }

  /**
   * 监听接管信号
   */
  async onTakeover(handler: (signal: TakeoverSignal) => void): Promise<void> {
    const wrappedHandler = (signal: unknown) => {
      const s = signal as TakeoverSignal
      handler(s)
    }
    this.handlers.set('takeover', wrappedHandler)
    await this.signalBus.subscribeTakeover(wrappedHandler as (signal: TakeoverSignal) => void)
  }

  /**
   * 监听恢复信号
   */
  async onResume(handler: (signal: ResumeSignal) => void): Promise<void> {
    const wrappedHandler = (signal: unknown) => {
      const s = signal as ResumeSignal
      handler(s)
    }
    this.handlers.set('resume', wrappedHandler)
    await this.signalBus.subscribeResume(wrappedHandler as (signal: ResumeSignal) => void)
  }

  /**
   * 发送确认
   */
  async sendAck(signal: TakeoverSignal): Promise<void> {
    const ack: AckSignal = {
      type: 'ack',
      sessionId: signal.sessionId,
      signalType: 'takeover',
      timestamp: Date.now(),
    }
    await this.signalBus.publishAck(ack)
  }

  /**
   * 停止监听
   */
  async stop(): Promise<void> {
    await this.signalBus.unsubscribeAll()
    this.handlers.clear()
  }
}
