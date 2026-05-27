/**
 * @colomind/sentinel - 安全守护母 Agent
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

// 推理代理（第二层）
export {
  InferenceAgent,
  InferenceAgentConfig,
  InferenceContext,
  InferenceResult,
  getInferenceAgent,
  resetInferenceAgent,
} from './inference-agent.js'

// 合法指引（第三层）
export {
  LegalGuidanceGenerator,
  LegalGuidanceConfig,
  LegalGuidance,
  GuidanceContext,
  getLegalGuidanceGenerator,
  resetLegalGuidanceGenerator,
} from './legal-guidance.js'

// 法律知识库
export {
  LegalKnowledgeBase,
  LegalProvision,
  Jurisdiction,
  LegalConsequence,
  ViolationElements,
  JurisdictionModule,
  ComplianceChannel,
  ReasoningContext,
  LegalReasoningResult,
  getLegalKnowledgeBase,
  resetLegalKnowledgeBase,
} from './legal-knowledge.js'

// 法律条文学习器
export {
  LegalLearner,
  LegalLearnerConfig,
  LegalDocument,
  LearningResult,
  getLegalLearner,
  resetLegalLearner,
} from './legal-learner.js'

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
  SentinelSelfHeartbeat,
  SentinelSelfCheckConfig,
  SentinelHealthStatus,
} from './heartbeat.js'

// 状态同步
export { SessionState, StateStore, StateUpdater, getStateStore, resetStateStore } from './state.js'

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

// 输出异步扫描
export { OutputScanner, OutputScanResult, OutputScanConfig } from './output-scanner.js'

// 会话超时监控
export {
  SessionTimeoutMonitor,
  SessionTimeoutConfig,
  SessionTimeoutState,
  TimeoutStage,
  TimeoutCallback,
  defaultTimeoutMessages,
} from './timeout-monitor.js'

// 本地分类模型
export {
  LocalModelManager,
  LocalModelConfig,
  ClassificationResult,
  ContentCategory,
  IClassifier,
  MockClassifier,
  ONNXClassifier,
  getLocalModelManager,
  resetLocalModelManager,
} from './local-model.js'

// Layer 1.5 本地意图分析器
export {
  LocalIntentAnalyzer,
  LocalIntentAnalyzerConfig,
  LocalIntentResult,
  IntentCategory,
  getLocalIntentAnalyzer,
  resetLocalIntentAnalyzer,
} from './local-intent-analyzer.js'

// LLM 接管回复
export {
  LLMTakeoverGenerator,
  LLMTakeoverConfig,
  TakeoverContext,
  TakeoverMessageManager,
  MockLLMGenerator,
  ILLMTakeoverGenerator,
  getTakeoverMessageManager,
  resetTakeoverMessageManager,
} from './llm-takeover.js'

// Redis 共享状态
export {
  RedisConfig,
  RedisStateStore,
  MockRedisClient,
  IRedisClient,
  createRedisClient,
} from './redis-store.js'

// Redis Pub/Sub
export {
  RedisSignalBus,
  RedisSignalBusConfig,
  RedisTakeoverManager,
  RedisSignalReceiver,
} from './redis-signal.js'

// 日志工具
export { createLogger, setLogLevel, getLogLevel, type Logger, type LogLevel } from './logger.js'

// Charter 许可证守护
export {
  CharterGuard,
  CharterGuardConfig,
  CapabilityCheckResult,
  getCharterGuard,
  resetCharterGuard,
} from './charter-guard.js'

// ═══════════════════════════════════════════════════════════════
// 安全守护母 Agent 主类
// ═══════════════════════════════════════════════════════════════

import { RuleEngine, getRuleEngine, RuleScanResult } from './rule-engine.js'
import { FallbackMessages, getFallbackMessages, FallbackType } from './fallback.js'
import { HeartbeatMonitor, HeartbeatSender, Heartbeat, SentinelSelfHeartbeat } from './heartbeat.js'
import { StateStore, StateUpdater, SessionState } from './state.js'
import { SignalBus, TakeoverManager, TakeoverSignal, TakeoverReason } from './signal.js'
import {
  SessionTimeoutMonitor,
  SessionTimeoutConfig,
  defaultTimeoutMessages,
} from './timeout-monitor.js'
import { InferenceAgent, InferenceResult, InferenceContext } from './inference-agent.js'
import { LegalGuidanceGenerator, LegalGuidance } from './legal-guidance.js'
import { createLogger } from './logger.js'
import { getLegalKnowledgeBase, type Jurisdiction } from './legal-knowledge.js'
import { LocalIntentAnalyzer, LocalIntentResult } from './local-intent-analyzer.js'
import type { LLMProvider } from '@colomind/types'

const logger = createLogger('Sentinel')

export interface SentinelConfig {
  ruleEngine?: RuleEngine
  fallbackMessages?: FallbackMessages
  heartbeatInterval?: number
  missedBeatsThreshold?: number
  timeoutConfig?: Partial<SessionTimeoutConfig>
  selfCheckInterval?: number
  selfCheckThreshold?: number
  /** LLM Provider 用于第二层推理和第三层指引 */
  llmProvider?: LLMProvider
  /** 推理模型 */
  inferenceModel?: string
  /** 法律文档目录 */
  legalDocsPath?: string
  /** 默认法域 */
  defaultJurisdiction?: Jurisdiction
  /** 启用 Layer 1.5 本地意图分析 */
  enableLayer15?: boolean
  /** Layer 1.5 置信度阈值 */
  layer15ConfidenceThreshold?: number
}

export class Sentinel {
  private ruleEngine: RuleEngine
  private fallbacks: FallbackMessages
  private heartbeatMonitor: HeartbeatMonitor
  private stateStore: StateStore
  private signalBus: SignalBus
  private takeoverManager: TakeoverManager
  private timeoutMonitor: SessionTimeoutMonitor
  private selfHeartbeat: SentinelSelfHeartbeat
  // 第二层：推理代理
  private inferenceAgent: InferenceAgent
  // 第三层：合法指引生成器
  private legalGuidanceGenerator: LegalGuidanceGenerator
  // Layer 1.5：本地意图分析器
  private localIntentAnalyzer: LocalIntentAnalyzer
  private enableLayer15: boolean

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

    // 超时监控
    this.timeoutMonitor = new SessionTimeoutMonitor(config?.timeoutConfig)
    this.timeoutMonitor.setCallbacks({
      onWarning: defaultTimeoutMessages.onWarning,
      onPrompt: defaultTimeoutMessages.onPrompt,
      onTakeover: (sessionId) => {
        this.triggerTakeover(sessionId, 'timeout')
        return defaultTimeoutMessages.onTakeover(sessionId, 120000)
      },
    })

    // 设置失联回调
    this.heartbeatMonitor.setOnAgentDead((agentId) => {
      this.handleAgentDead(agentId)
    })

    // 设置接管回调
    this.takeoverManager.setOnTakeover((signal) => {
      return this.generateTakeoverMessage(signal)
    })

    // 自身心跳
    this.selfHeartbeat = new SentinelSelfHeartbeat({
      interval: config?.selfCheckInterval ?? 1000,
      threshold: config?.selfCheckThreshold ?? 5000,
    })
    this.selfHeartbeat.setOnStatusChange((status) => {
      logger.info('Self health status changed', { status })
    })

    // 第二层：推理代理
    this.inferenceAgent = new InferenceAgent({
      llmProvider: config?.llmProvider,
      model: config?.inferenceModel,
    })

    // 第三层：合法指引生成器
    this.legalGuidanceGenerator = new LegalGuidanceGenerator({
      llmProvider: config?.llmProvider,
      model: config?.inferenceModel,
    })

    // Layer 1.5：本地意图分析器
    this.enableLayer15 = config?.enableLayer15 ?? true
    this.localIntentAnalyzer = new LocalIntentAnalyzer({
      confidenceThreshold: config?.layer15ConfidenceThreshold ?? 0.75,
    })

    // 初始化法律知识库
    const knowledgeBase = getLegalKnowledgeBase()
    if (config?.legalDocsPath) {
      knowledgeBase.loadFromDirectory(config.legalDocsPath).then(count => {
        logger.info(`Loaded ${count} legal provisions from ${config.legalDocsPath}`)
      })
    } else {
      knowledgeBase.initializeDefaults()
    }
  }

  /**
   * 启动守护
   */
  start(): void {
    logger.info('Sentinel started')
    this.heartbeatMonitor.start()
    this.timeoutMonitor.start()
    this.selfHeartbeat.start()
  }

  /**
   * 停止守护
   */
  stop(): void {
    logger.info('Sentinel stopped')
    this.heartbeatMonitor.stop()
    this.timeoutMonitor.stop()
    this.selfHeartbeat.stop()
  }

  /**
   * 更新自身心跳（每个事件循环调用）
   */
  beat(): void {
    this.selfHeartbeat.beat()
  }

  /**
   * 获取自身健康状态
   */
  getSelfHealthStatus() {
    return {
      status: this.selfHeartbeat.getStatus(),
      lastBeat: this.selfHeartbeat.getLastBeat(),
      eventLoopLag: this.selfHeartbeat.getEventLoopLag(),
    }
  }

  /**
   * 外部检查接口（供守护进程调用）
   */
  externalCheck(): 'alive' | 'dead' {
    return this.selfHeartbeat.externalCheck()
  }

  // ─── 输入扫描 ───────────────────────────────────────────────

  /**
   * 扫描输入（同步，<1ms）- 第一层防御
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
      logger.warn('Input blocked', {
        sessionId,
        reason: result.reason,
        message: message.substring(0, 50),
      })
      const fallbackType = this.mapReasonToFallbackType(result.reason)
      const response = this.fallbacks.get(fallbackType)
      return { pass: false, response }
    }

    return { pass: true }
  }

  /**
   * 三层防御扫描 - 完整的安全检查流程
   *
   * 第一层：规则引擎（毫秒级，不可绕过）
   * Layer 1.5：本地意图分析器（快速分类，减少LLM调用）
   * 第二层：推理代理（LLM 语义分析）
   * 第三层：合法指引生成
   */
  async fullScan(
    message: string,
    sessionId?: string,
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>,
    jurisdiction?: Jurisdiction,
  ): Promise<{
    pass: boolean
    response?: string
    guidance?: LegalGuidance
    inference?: InferenceResult
    layer15?: LocalIntentResult
  }> {
    const userJurisdiction = jurisdiction || 'CN'

    // 第一层：规则引擎
    const ruleResult = this.scanInput(message, sessionId)

    if (!ruleResult.pass) {
      logger.info('Layer 1 blocked', { reason: ruleResult.reason, matched: ruleResult.matched })

      // 第二层：推理代理分析
      const inferenceResult = await this.inferenceAgent.infer({
        message,
        sessionId,
        conversationHistory,
        matchedRule: {
          type: ruleResult.reason as 'blocked_word' | 'blocked_pattern',
          matched: ruleResult.matched || ruleResult.pattern || '',
        },
        jurisdiction: userJurisdiction,
      })

      logger.info('Layer 2 inference', { scenario: inferenceResult.scenario, confidence: inferenceResult.confidence })

      // 根据推理结果决定是否需要接管
      if (inferenceResult.needsTakeover || inferenceResult.scenario === 'blocked') {
        // 第三层：生成合法指引
        const guidance = await this.legalGuidanceGenerator.generate({
          userMessage: message,
          inferenceResult,
          sessionId,
          jurisdiction: userJurisdiction,
        })

        logger.info('Layer 3 guidance generated', { type: guidance.type })

        return {
          pass: false,
          response: guidance.message,
          guidance,
          inference: inferenceResult,
        }
      }

      // 推理结果为合法帮助，生成指引但允许继续
      if (inferenceResult.scenario === 'legal_help') {
        const guidance = await this.legalGuidanceGenerator.generate({
          userMessage: message,
          inferenceResult,
          sessionId,
          jurisdiction: userJurisdiction,
        })

        // 返回指引，但标记为通过（让主 Agent 继续处理）
        return {
          pass: true,
          guidance,
          inference: inferenceResult,
        }
      }

      // 模糊试探，返回安全提示
      if (inferenceResult.scenario === 'ambiguous_probing') {
        const guidance = await this.legalGuidanceGenerator.generate({
          userMessage: message,
          inferenceResult,
          sessionId,
          jurisdiction: userJurisdiction,
        })

        return {
          pass: false,
          response: guidance.message,
          guidance,
          inference: inferenceResult,
        }
      }
    }

    // Layer 1.5：本地意图分析（Layer 1 通过后）
    if (this.enableLayer15) {
      const layer15Result = this.localIntentAnalyzer.analyze(message, { history: conversationHistory })

      logger.info('Layer 1.5 analysis', {
        category: layer15Result.category,
        confidence: layer15Result.confidence,
        needsLayer2: layer15Result.needsLayer2,
      })

      // 明确危险 - 直接拦截，不调LLM
      if (layer15Result.category === 'dangerous') {
        const guidance = await this.legalGuidanceGenerator.generate({
          userMessage: message,
          inferenceResult: {
            scenario: 'blocked',
            confidence: layer15Result.confidence,
            intent: layer15Result.reason,
            needsTakeover: true,
            riskLevel: 'high',
            reasoning: layer15Result.detectedPatterns.join('; '),
          },
          sessionId,
          jurisdiction: userJurisdiction,
        })

        return {
          pass: false,
          response: guidance.message,
          guidance,
          layer15: layer15Result,
        }
      }

      // 明确安全 - 直接放行，不调LLM
      if (layer15Result.category === 'safe' && !layer15Result.needsLayer2) {
        return {
          pass: true,
          layer15: layer15Result,
        }
      }

      // 可疑或模糊 - 转Layer 2
      if (layer15Result.needsLayer2) {
        const inferenceResult = await this.inferenceAgent.infer({
          message,
          sessionId,
          conversationHistory,
          jurisdiction: userJurisdiction,
        })

        if (inferenceResult.needsTakeover || inferenceResult.scenario === 'blocked') {
          const guidance = await this.legalGuidanceGenerator.generate({
            userMessage: message,
            inferenceResult,
            sessionId,
            jurisdiction: userJurisdiction,
          })

          return {
            pass: false,
            response: guidance.message,
            guidance,
            inference: inferenceResult,
            layer15: layer15Result,
          }
        }

        return {
          pass: true,
          inference: inferenceResult,
          layer15: layer15Result,
        }
      }
    }

    // 第一层通过，进行语义安全检查
    const inferenceResult = await this.inferenceAgent.infer({
      message,
      sessionId,
      conversationHistory,
      jurisdiction: userJurisdiction,
    })

    if (inferenceResult.needsTakeover) {
      const guidance = await this.legalGuidanceGenerator.generate({
        userMessage: message,
        inferenceResult,
        sessionId,
        jurisdiction: userJurisdiction,
      })

      return {
        pass: false,
        response: guidance.message,
        guidance,
        inference: inferenceResult,
      }
    }

    return { pass: true, inference: inferenceResult }
  }

  /**
   * 设置 LLM Provider（用于动态配置）
   */
  setLLMProvider(provider: LLMProvider): void {
    this.inferenceAgent.setLLMProvider(provider)
    this.legalGuidanceGenerator.setLLMProvider(provider)
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
    logger.debug('Heartbeat received', { agentId: heartbeat.agentId, status: heartbeat.status })
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
    logger.warn('Takeover triggered', { sessionId, reason })
    return this.takeoverManager.trigger(sessionId, reason)
  }

  /**
   * 创建信号接收器（父 Agent 侧）
   */
  createSignalReceiver(agentId: string) {
    return new SignalReceiver(this.signalBus, agentId)
  }

  // ─── 会话超时监控 ───────────────────────────────────────────

  /**
   * 开始监控会话超时
   */
  startSessionTimeout(sessionId: string, agentId: string): void {
    logger.info('Session timeout monitoring started', { sessionId, agentId })
    this.timeoutMonitor.startSession(sessionId, agentId)
  }

  /**
   * 更新会话活动（重置超时计时）
   */
  touchSession(sessionId: string): void {
    this.timeoutMonitor.touchSession(sessionId)
  }

  /**
   * 结束会话超时监控
   */
  endSessionTimeout(sessionId: string): void {
    this.timeoutMonitor.endSession(sessionId)
  }

  /**
   * 获取超时会话的待发送消息
   */
  getTimeoutMessages(): Array<{ sessionId: string; stage: string; message: string }> {
    return this.timeoutMonitor.getPendingMessages()
  }

  /**
   * 获取会话超时状态
   */
  getSessionTimeoutState(sessionId: string) {
    return this.timeoutMonitor.getSessionState(sessionId)
  }

  // ─── 内部方法 ───────────────────────────────────────────────

  /**
   * 处理 Agent 失联
   */
  private handleAgentDead(agentId: string): void {
    logger.error('Agent is dead, triggering takeover', { agentId })

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
      return this.fallbacks.getWithContext(this.mapReasonToFallbackType(signal.reason), {
        task: state.currentTask,
        lastMessage: state.lastUserMessage,
      })
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
