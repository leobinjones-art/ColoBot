/**
 * 心跳协议
 *
 * 父 Agent 每 2 秒发送心跳，母 Agent 连续 3 次无响应判定失联
 * 母 Agent 自身也有心跳自检机制
 */

// ═══════════════════════════════════════════════════════════════
// 心跳类型定义
// ═══════════════════════════════════════════════════════════════

export interface Heartbeat {
  type: 'heartbeat'
  from: 'parent' | 'sentinel'
  agentId: string
  timestamp: number
  status: 'idle' | 'busy' | 'error'
  currentSessionCount: number
  avgResponseTime?: number
}

export interface HeartbeatConfig {
  interval: number        // 心跳间隔（毫秒）
  missedThreshold: number // 连续多少次无响应判定失联
}

const DEFAULT_CONFIG: HeartbeatConfig = {
  interval: 2000,
  missedThreshold: 3,
}

// ═══════════════════════════════════════════════════════════════
// 心跳监控器（母 Agent 侧）
// ═══════════════════════════════════════════════════════════════

export interface AgentHealthStatus {
  agentId: string
  lastHeartbeat: number
  missedBeats: number
  status: 'healthy' | 'unhealthy' | 'dead'
  lastStatus: 'idle' | 'busy' | 'error'
}

export class HeartbeatMonitor {
  private config: HeartbeatConfig
  private agents: Map<string, AgentHealthStatus> = new Map()
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private onAgentDead?: (agentId: string) => void

  constructor(config?: Partial<HeartbeatConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 设置 Agent 失联回调
   */
  setOnAgentDead(callback: (agentId: string) => void): void {
    this.onAgentDead = callback
  }

  /**
   * 接收心跳
   */
  receiveHeartbeat(heartbeat: Heartbeat): void {
    const existing = this.agents.get(heartbeat.agentId)

    if (existing) {
      existing.lastHeartbeat = heartbeat.timestamp
      existing.missedBeats = 0
      existing.status = 'healthy'
      existing.lastStatus = heartbeat.status
    } else {
      this.agents.set(heartbeat.agentId, {
        agentId: heartbeat.agentId,
        lastHeartbeat: heartbeat.timestamp,
        missedBeats: 0,
        status: 'healthy',
        lastStatus: heartbeat.status,
      })
    }
  }

  /**
   * 开始监控
   */
  start(): void {
    if (this.checkTimer) return

    this.checkTimer = setInterval(() => {
      this.checkAgents()
    }, this.config.interval)
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
   * 检查所有 Agent 状态
   */
  private checkAgents(): void {
    const now = Date.now()
    const threshold = this.config.interval * this.config.missedThreshold

    for (const [agentId, status] of this.agents) {
      const elapsed = now - status.lastHeartbeat

      if (elapsed > threshold) {
        // 超过阈值，判定失联
        if (status.status !== 'dead') {
          status.status = 'dead'
          status.missedBeats = this.config.missedThreshold

          // 触发回调
          if (this.onAgentDead) {
            this.onAgentDead(agentId)
          }
        }
      } else if (elapsed > this.config.interval) {
        // 超过一个周期，增加计数
        status.missedBeats++
        if (status.missedBeats >= this.config.missedThreshold) {
          status.status = 'unhealthy'
        }
      }
    }
  }

  /**
   * 获取 Agent 状态
   */
  getAgentStatus(agentId: string): AgentHealthStatus | undefined {
    return this.agents.get(agentId)
  }

  /**
   * 获取所有 Agent 状态
   */
  getAllStatus(): AgentHealthStatus[] {
    return Array.from(this.agents.values())
  }

  /**
   * 移除 Agent
   */
  removeAgent(agentId: string): void {
    this.agents.delete(agentId)
  }

  /**
   * 清理所有 Agent
   */
  clear(): void {
    this.agents.clear()
  }
}

// ═══════════════════════════════════════════════════════════════
// 心跳发送器（父 Agent 侧）
// ═══════════════════════════════════════════════════════════════

export class HeartbeatSender {
  private agentId: string
  private config: HeartbeatConfig
  private sendTimer: ReturnType<typeof setInterval> | null = null
  private onSend?: (heartbeat: Heartbeat) => void
  private status: 'idle' | 'busy' | 'error' = 'idle'
  private sessionCount = 0
  private responseTimes: number[] = []

  constructor(agentId: string, config?: Partial<HeartbeatConfig>) {
    this.agentId = agentId
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 设置心跳发送回调
   */
  setOnSend(callback: (heartbeat: Heartbeat) => void): void {
    this.onSend = callback
  }

  /**
   * 更新状态
   */
  setStatus(status: 'idle' | 'busy' | 'error'): void {
    this.status = status
  }

  /**
   * 更新会话数
   */
  setSessionCount(count: number): void {
    this.sessionCount = count
  }

  /**
   * 记录响应时间
   */
  recordResponseTime(ms: number): void {
    this.responseTimes.push(ms)
    // 保留最近 10 次
    if (this.responseTimes.length > 10) {
      this.responseTimes.shift()
    }
  }

  /**
   * 开始发送心跳
   */
  start(): void {
    if (this.sendTimer) return

    this.sendTimer = setInterval(() => {
      this.sendHeartbeat()
    }, this.config.interval)
  }

  /**
   * 停止发送心跳
   */
  stop(): void {
    if (this.sendTimer) {
      clearInterval(this.sendTimer)
      this.sendTimer = null
    }
  }

  /**
   * 发送心跳
   */
  private sendHeartbeat(): void {
    const avgResponseTime = this.responseTimes.length > 0
      ? this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length
      : undefined

    const heartbeat: Heartbeat = {
      type: 'heartbeat',
      from: 'parent',
      agentId: this.agentId,
      timestamp: Date.now(),
      status: this.status,
      currentSessionCount: this.sessionCount,
      avgResponseTime,
    }

    if (this.onSend) {
      this.onSend(heartbeat)
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 母 Agent 自身心跳（自检机制）
// ═══════════════════════════════════════════════════════════════

export interface SentinelSelfCheckConfig {
  interval: number       // 自检间隔（毫秒）
  threshold: number      // 超过多少毫秒无更新判定异常
}

const DEFAULT_SELF_CHECK_CONFIG: SentinelSelfCheckConfig = {
  interval: 1000,        // 每秒自检
  threshold: 5000,       // 5秒无更新判定异常
}

export type SentinelHealthStatus = 'healthy' | 'degraded' | 'dead'

/**
 * 母 Agent 自身心跳
 *
 * 每个事件循环都更新心跳时间戳，外部守护进程定时检查
 */
export class SentinelSelfHeartbeat {
  private config: SentinelSelfCheckConfig
  private lastBeat: number = Date.now()
  private checkTimer: ReturnType<typeof setInterval> | null = null
  private status: SentinelHealthStatus = 'healthy'
  private onStatusChange?: (status: SentinelHealthStatus) => void
  private eventLoopLag: number = 0

  constructor(config?: Partial<SentinelSelfCheckConfig>) {
    this.config = { ...DEFAULT_SELF_CHECK_CONFIG, ...config }
  }

  /**
   * 设置状态变化回调
   */
  setOnStatusChange(callback: (status: SentinelHealthStatus) => void): void {
    this.onStatusChange = callback
  }

  /**
   * 更新心跳（每个事件循环调用）
   */
  beat(): void {
    const now = Date.now()
    this.eventLoopLag = now - this.lastBeat
    this.lastBeat = now

    // 如果之前是异常状态，恢复为健康
    if (this.status !== 'healthy') {
      this.updateStatus('healthy')
    }
  }

  /**
   * 开始自检
   */
  start(): void {
    if (this.checkTimer) return

    this.checkTimer = setInterval(() => {
      this.check()
    }, this.config.interval)
  }

  /**
   * 停止自检
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
      this.checkTimer = null
    }
  }

  /**
   * 检查心跳状态
   */
  private check(): void {
    const elapsed = Date.now() - this.lastBeat

    if (elapsed > this.config.threshold) {
      // 超过阈值，判定异常
      this.updateStatus('dead')
    } else if (elapsed > this.config.threshold / 2) {
      // 超过一半阈值，降级
      this.updateStatus('degraded')
    }
  }

  /**
   * 更新状态
   */
  private updateStatus(newStatus: SentinelHealthStatus): void {
    if (this.status !== newStatus) {
      this.status = newStatus
      if (this.onStatusChange) {
        this.onStatusChange(newStatus)
      }
    }
  }

  /**
   * 获取当前状态
   */
  getStatus(): SentinelHealthStatus {
    return this.status
  }

  /**
   * 获取上次心跳时间
   */
  getLastBeat(): number {
    return this.lastBeat
  }

  /**
   * 获取事件循环延迟
   */
  getEventLoopLag(): number {
    return this.eventLoopLag
  }

  /**
   * 外部检查接口（供 systemd/PM2 等守护进程调用）
   */
  externalCheck(): 'alive' | 'dead' {
    const elapsed = Date.now() - this.lastBeat
    return elapsed > this.config.threshold ? 'dead' : 'alive'
  }
}
