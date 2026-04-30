/**
 * 会话超时监控
 *
 * 实现长期无反应的阶梯式处理：
 * - 30秒：提示"正在处理中"
 * - 60秒：询问"是否继续等待"
 * - 120秒：接管会话
 */

export interface SessionTimeoutConfig {
  warningMs: number // 警告时间（默认 30s）
  promptMs: number // 提示时间（默认 60s）
  takeoverMs: number // 接管时间（默认 120s）
  checkIntervalMs: number // 检查间隔（默认 5s）
}

const DEFAULT_CONFIG: SessionTimeoutConfig = {
  warningMs: 30000,
  promptMs: 60000,
  takeoverMs: 120000,
  checkIntervalMs: 5000,
}

export type TimeoutStage = 'normal' | 'warning' | 'prompt' | 'takeover'

export interface SessionTimeoutState {
  sessionId: string
  agentId: string
  startedAt: number
  lastUpdate: number
  stage: TimeoutStage
  message?: string
}

export interface TimeoutCallback {
  onWarning?: (sessionId: string, elapsed: number) => string
  onPrompt?: (sessionId: string, elapsed: number) => string
  onTakeover?: (sessionId: string, elapsed: number) => string
}

/**
 * 会话超时监控器
 */
export class SessionTimeoutMonitor {
  private config: SessionTimeoutConfig
  private sessions: Map<string, SessionTimeoutState> = new Map()
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private callbacks: TimeoutCallback = {}

  constructor(config?: Partial<SessionTimeoutConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 设置回调
   */
  setCallbacks(callbacks: TimeoutCallback): void {
    this.callbacks = callbacks
  }

  /**
   * 开始监控会话
   */
  startSession(sessionId: string, agentId: string): void {
    const now = Date.now()
    this.sessions.set(sessionId, {
      sessionId,
      agentId,
      startedAt: now,
      lastUpdate: now,
      stage: 'normal',
    })
  }

  /**
   * 更新会话活动（重置计时）
   */
  touchSession(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastUpdate = Date.now()
      // 如果之前已经进入警告/提示阶段，重置回正常
      if (session.stage !== 'takeover') {
        session.stage = 'normal'
        session.message = undefined
      }
    }
  }

  /**
   * 结束会话监控
   */
  endSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  /**
   * 开始监控
   */
  start(): void {
    if (this.checkTimer) return

    this.checkTimer = setInterval(() => {
      this.checkSessions()
    }, this.config.checkIntervalMs)
  }

  /**
   * 停止监控
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  /**
   * 检查所有会话
   */
  private checkSessions(): void {
    const now = Date.now()

    for (const [sessionId, state] of this.sessions) {
      if (state.stage === 'takeover') continue // 已接管的不处理

      const elapsed = now - state.lastUpdate

      if (elapsed >= this.config.takeoverMs) {
        // 接管
        state.stage = 'takeover'
        state.message = this.callbacks.onTakeover?.(sessionId, elapsed)
      } else if (elapsed >= this.config.promptMs) {
        // 提示是否继续等待
        if (state.stage !== 'prompt') {
          state.stage = 'prompt'
          state.message = this.callbacks.onPrompt?.(sessionId, elapsed)
        }
      } else if (elapsed >= this.config.warningMs) {
        // 警告
        if (state.stage === 'normal') {
          state.stage = 'warning'
          state.message = this.callbacks.onWarning?.(sessionId, elapsed)
        }
      }
    }
  }

  /**
   * 获取会话状态
   */
  getSessionState(sessionId: string): SessionTimeoutState | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * 获取所有超时会话
   */
  getTimeoutSessions(): SessionTimeoutState[] {
    return Array.from(this.sessions.values()).filter((s) => s.stage !== 'normal')
  }

  /**
   * 获取需要处理的会话（有消息待发送）
   */
  getPendingMessages(): Array<{ sessionId: string; stage: TimeoutStage; message: string }> {
    const result: Array<{ sessionId: string; stage: TimeoutStage; message: string }> = []

    for (const [sessionId, state] of this.sessions) {
      if (state.message && state.stage !== 'normal') {
        result.push({
          sessionId,
          stage: state.stage,
          message: state.message,
        })
        // 清除消息，避免重复发送
        state.message = undefined
      }
    }

    return result
  }

  /**
   * 清理所有会话
   */
  clear(): void {
    this.sessions.clear()
  }
}

/**
 * 默认超时消息生成器
 */
export const defaultTimeoutMessages = {
  onWarning: (sessionId: string, elapsed: number): string => {
    const seconds = Math.round(elapsed / 1000)
    return `正在处理中，请稍候...（已等待 ${seconds} 秒）`
  },

  onPrompt: (sessionId: string, elapsed: number): string => {
    const seconds = Math.round(elapsed / 1000)
    return `任务执行时间较长（${seconds} 秒），是否继续等待？\n输入"继续"继续等待，或描述新的问题。`
  },

  onTakeover: (sessionId: string, elapsed: number): string => {
    const seconds = Math.round(elapsed / 1000)
    return `抱歉，任务执行超时（${seconds} 秒），已为您终止当前任务。\n请重新描述您的需求，或稍后重试。`
  },
}
