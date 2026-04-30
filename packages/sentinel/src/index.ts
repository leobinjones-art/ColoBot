/**
 * @colobot/sentinel - 安全守护母 Agent
 *
 * 平行链路架构，负责：
 * - 输入/输出扫描
 * - 进程守护（心跳监控）
 * - 异常接管
 */

// 规则引擎（第一层）
export {
  RuleEngine,
  RuleScanResult,
  RuleEngineConfig,
  getRuleEngine,
  resetRuleEngine,
} from './rule-engine.js'

// 静态兜底话术
export {
  FallbackMessages,
  FallbackType,
  getFallbackMessages,
  resetFallbackMessages,
} from './fallback.js'

// 心跳协议
export {
  Heartbeat,
  HeartbeatConfig,
  HeartbeatMonitor,
  HeartbeatSender,
  AgentHealthStatus,
} from './heartbeat.js'

// 状态同步
export {
  SessionState,
  StateStore,
  StateUpdater,
  getStateStore,
  resetStateStore,
} from './state.js'

// 接管信号
export {
  TakeoverSignal,
  ResumeSignal,
  AckSignal,
  TakeoverReason,
  TakeoverAction,
  SignalBus,
  TakeoverManager,
  SignalReceiver,
  getSignalBus,
  resetSignalBus,
} from './signal.js'

// ═══════════════════════════════════════════════════════════════
// 安全守护母 Agent 主类
// ═══════════════════════════════════════════════════════════════

import { RuleEngine, getRuleEngine, RuleScanResult } from './rule-engine.js'
import { FallbackMessages, getFallbackMessages, FallbackType } from './fallback.js'
import { HeartbeatMonitor, HeartbeatSender, Heartbeat } from './heartbeat.js'
import { StateStore, StateUpdater, SessionState } from './state.js'
import { SignalBus, TakeoverManager, TakeoverSignal, TakeoverReason } from './signal.js'

export interface SentinelConfig {
  ruleEngine?: RuleEngine
  fallbackMessages?: FallbackMessages
  heartbeatInterval?: number
  missedBeatsThreshold?: number
}

export class Sentinel {
  private ruleEngine: RuleEngine
  private fallbacks: FallbackMessages
  private heartbeatMonitor: HeartbeatMonitor
  private stateStore: StateStore
  private signalBus: SignalBus
  private takeoverManager: TakeoverManager

  constructor(config?: SentinelConfig) {
    this.ruleEngine = config?.ruleEngine ?? getRuleEngine()
    this.fallbacks = getFallbackMessages()

    this.heartbeatMonitor = new HeartbeatMonitor({
      interval: config?.heartbeatInterval ?? 2000,
      missedThreshold: config?.missedBeatsThreshold ?? 3,
    })

    this.stateStore = new StateStore()
    this.signalBus = new SignalBus()
    this.takeoverManager = new TakeoverManager(this.signalBus)

    // 设置失联回调
    this.heartbeatMonitor.setOnAgentDead((agentId) => {
      this.handleAgentDead(agentId)
    })

    // 设置接管回调
    this.takeoverManager.setOnTakeover((signal) => {
      return this.generateTakeoverMessage(signal)
    })
  }

  /**
   * 启动守护
   */
  start(): void {
    this.heartbeatMonitor.start()
  }

  /**
   * 停止守护
   */
  stop(): void {
    this.heartbeatMonitor.stop()
  }

  // ─── 输入扫描 ───────────────────────────────────────────────

  /**
   * 扫描输入（同步，<1ms）
   */
  scanInput(message: string, sessionId?: string): RuleScanResult {
    return this.ruleEngine.scanInput(message, sessionId)
  }

  /**
   * 扫描输入并处理异常
   */
  scanInputWithTakeover(message: string, sessionId: string): { pass: boolean; response?: string } {
    const result = this.scanInput(message, sessionId)

    if (!result.pass) {
      const fallbackType = this.mapReasonToFallbackType(result.reason)
      const response = this.fallbacks.get(fallbackType)
      return { pass: false, response }
    }

    return { pass: true }
  }

  // ─── 输出扫描 ───────────────────────────────────────────────

  /**
   * 扫描输出（同步，<1ms）
   */
  scanOutput(response: string): RuleScanResult {
    return this.ruleEngine.scanOutput(response)
  }

  // ─── 心跳监控 ───────────────────────────────────────────────

  /**
   * 接收心跳
   */
  receiveHeartbeat(heartbeat: Heartbeat): void {
    this.heartbeatMonitor.receiveHeartbeat(heartbeat)
  }

  /**
   * 获取 Agent 状态
   */
  getAgentHealthStatus(agentId: string) {
    return this.heartbeatMonitor.getAgentStatus(agentId)
  }

  // ─── 状态同步 ───────────────────────────────────────────────

  /**
   * 获取会话状态
   */
  getSessionState(sessionId: string): SessionState | undefined {
    return this.stateStore.get(sessionId)
  }

  /**
   * 创建状态更新器（父 Agent 侧）
   */
  createStateUpdater(agentId: string): StateUpdater {
    return new StateUpdater(this.stateStore, agentId)
  }

  // ─── 接管 ───────────────────────────────────────────────────

  /**
   * 触发接管
   */
  triggerTakeover(sessionId: string, reason: TakeoverReason): string {
    return this.takeoverManager.trigger(sessionId, reason)
  }

  /**
   * 创建信号接收器（父 Agent 侧）
   */
  createSignalReceiver(agentId: string) {
    return new SignalReceiver(this.signalBus, agentId)
  }

  // ─── 内部方法 ───────────────────────────────────────────────

  /**
   * 处理 Agent 失联
   */
  private handleAgentDead(agentId: string): void {
    console.log(`[Sentinel] Agent ${agentId} is dead, triggering takeover`)

    // 获取该 Agent 的所有会话
    const sessions = this.stateStore.getByAgent(agentId)
    for (const session of sessions) {
      if (session.status === 'processing') {
        this.triggerTakeover(session.sessionId, 'parent_unresponsive')
      }
    }
  }

  /**
   * 生成接管话术
   */
  private generateTakeoverMessage(signal: TakeoverSignal): string {
    const state = this.stateStore.get(signal.sessionId)

    if (state) {
      return this.fallbacks.getWithContext(
        this.mapReasonToFallbackType(signal.reason),
        {
          task: state.currentTask,
          lastMessage: state.lastUserMessage,
        }
      )
    }

    return this.fallbacks.get(this.mapReasonToFallbackType(signal.reason))
  }

  /**
   * 映射扫描原因到话术类型
   */
  private mapReasonToFallbackType(reason?: string): FallbackType {
    switch (reason) {
      case 'blocked_word':
      case 'blocked_pattern':
        return 'input_blocked'
      case 'too_long':
        return 'input_blocked'
      case 'rate_limit':
        return 'rate_limit'
      default:
        return 'unknown_error'
    }
  }
}

// 导入 SignalReceiver 用于类型导出
import { SignalReceiver } from './signal.js'

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultSentinel: Sentinel | null = null

export function getSentinel(config?: SentinelConfig): Sentinel {
  if (!defaultSentinel) {
    defaultSentinel = new Sentinel(config)
  }
  return defaultSentinel
}

export function resetSentinel(config?: SentinelConfig): Sentinel {
  defaultSentinel = new Sentinel(config)
  return defaultSentinel
}