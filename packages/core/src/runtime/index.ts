/**
 * Agent 运行时核心逻辑
 */

import type { LLMMessage, ContentBlock, ToolCall, ToolContext } from '@nexusmind/types'
import type { RuntimeDeps, LLMResponse } from './types.js'
import type { StateUpdater, OutputScanner, OutputScanConfig } from '@nexusmind/sentinel'
import { Sentinel, OutputScanner as OutputScannerClass } from '@nexusmind/sentinel'
import { compressMessages, estimateMessagesTokens } from '../compression.js'

// 导出接口和实现
export * from './interface.js'
export { ColoBotRuntimeImpl } from './runtime.js'
export type { ColoBotRuntime, RuntimeDependencies } from './interface.js'

export interface RunOptions {
  agentId: string
  sessionKey: string
  userMessage: string | ContentBlock[]
  maxRounds?: number
  ipAddress?: string
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  /** Soul 配置 */
  soul?: { personality?: string; role?: string }
  /** 上下文窗口大小（用于压缩） */
  contextWindowSize?: number
  /** Fallback 模型 ID */
  fallbackModelId?: string
}

export interface RunResult {
  response: string | ContentBlock[]
  toolCalls: string[]
  finished: boolean
  blocked?: boolean
  blockedReason?: string
}

/** 待继续状态（危险工具审批中暂存） */
export interface PendingConversation {
  id: string
  approvalId: string
  agentId: string
  sessionKey: string
  messages: LLMMessage[]
  dangerousCalls: ToolCall[]
  currentRound: number
  allowedCalls: ToolCall[]
  blockedCalls: ToolCall[]
  ipAddress?: string
}

export interface PendingResult {
  pending: true
  approvalId: string
}

const DEFAULT_MAX_ROUNDS = 10
const DEFAULT_CONTEXT_WINDOW = 128_000

/**
 * Agent 运行时
 */
export class AgentRuntime {
  private outputScanner?: OutputScannerClass

  constructor(private deps: RuntimeDeps) {
    // 初始化输出扫描器
    if (deps.sentinel) {
      this.outputScanner = new OutputScannerClass(deps.sentinel, {
        enabled: true,
        recallCallback: (sessionId, original, replacement) => {
          // 异步撤回回调 - 可通过 pusher 通知前端
          console.log(`[OutputScanner] Session ${sessionId} output recalled`)
        },
      })
    }
  }

  async run(opts: RunOptions): Promise<RunResult> {
    const {
      agentId,
      sessionKey,
      userMessage,
      maxRounds = DEFAULT_MAX_ROUNDS,
      ipAddress,
      systemPrompt,
      temperature,
      maxTokens,
      soul,
      contextWindowSize = DEFAULT_CONTEXT_WINDOW,
    } = opts

    const sentinel = this.deps.sentinel
    const messageText =
      typeof userMessage === 'string'
        ? userMessage
        : userMessage.map((b) => (b.type === 'text' ? b.text : '')).join(' ')

    // ─── 输入扫描（同步） ─────────────────────────────────────
    if (sentinel) {
      const scanResult = sentinel.scanInput(messageText, sessionKey)
      if (!scanResult.pass) {
        // 输入被拦截
        const fallbackResponse = sentinel.scanInputWithTakeover(messageText, sessionKey)
        await this.deps.memory.append(agentId, sessionKey, 'user', userMessage)
        await this.deps.memory.append(agentId, sessionKey, 'assistant', fallbackResponse.response)
        return {
          response: fallbackResponse.response!,
          toolCalls: [],
          finished: true,
          blocked: true,
          blockedReason: scanResult.reason,
        }
      }
    }

    // ─── 状态同步：开始处理 ─────────────────────────────────────
    let stateUpdater: StateUpdater | undefined
    if (sentinel) {
      stateUpdater = sentinel.createStateUpdater(agentId)
      stateUpdater.startProcessing(sessionKey, messageText)
    }

    // 获取历史
    const history = await this.deps.memory.getHistory(agentId, sessionKey)

    // 构建消息
    let messages: LLMMessage[] = [...history, { role: 'user', content: userMessage }]

    // 追加用户消息
    await this.deps.memory.append(agentId, sessionKey, 'user', userMessage)

    // Context Compression：超过 80% context window 时压缩
    const totalTokens = estimateMessagesTokens(messages)
    if (totalTokens > contextWindowSize * 0.8) {
      messages = await compressMessages(messages, contextWindowSize, this.deps.llm, systemPrompt)
    }

    const toolCallNames: string[] = []
    const toolCtx: ToolContext = { agentId, sessionKey, ipAddress }
    let finalContent: string | ContentBlock[] = ''

    // LLM 循环
    for (let round = 0; round < maxRounds; round++) {
      // 状态同步：更新进度
      if (stateUpdater) {
        stateUpdater.updateProgress(
          sessionKey,
          `Processing round ${round + 1}`,
          (round / maxRounds) * 80,
        )
      }

      // 构建 system prompt
      const fullMessages = this.buildMessagesWithSystem(messages, soul, systemPrompt)

      const response = await this.deps.llm.chat(fullMessages, {
        temperature,
        maxTokens,
        tools: this.deps.tools.getTools?.() || undefined,
      })

      const rawContent = response.content
      messages.push({ role: 'assistant', content: rawContent })

      // 处理原生 tool_calls（优先）
      if (response.toolCalls && response.toolCalls.length > 0) {
        toolCallNames.push(...response.toolCalls.map((c) => c.name))
        const results = await this.deps.tools.execute(response.toolCalls, toolCtx)
        const resultText = this.deps.tools.format(results)
        messages.push({ role: 'user', content: resultText })
        finalContent = rawContent
        continue
      }

      // 解析 XML 格式工具调用（兼容）
      const rawText =
        typeof rawContent === 'string'
          ? rawContent
          : rawContent.map((b) => (b.type === 'text' ? b.text : `[${b.type}]`)).join(' ')

      const toolCalls = this.deps.tools.parse(rawText)

      if (toolCalls.length === 0) {
        finalContent = rawContent
        break
      }

      toolCallNames.push(...toolCalls.map((c) => c.name))

      // 执行工具
      const results = await this.deps.tools.execute(toolCalls, toolCtx)
      const resultText = this.deps.tools.format(results)

      messages.push({ role: 'user', content: resultText })
      finalContent = rawContent
    }

    // 保存助手回复
    await this.deps.memory.append(agentId, sessionKey, 'assistant', finalContent)

    // ─── 输出扫描（异步） ─────────────────────────────────────
    let responseToReturn = finalContent
    if (this.outputScanner && typeof finalContent === 'string') {
      // 异步扫描，先返回原始内容
      responseToReturn = this.outputScanner.scanAsync(finalContent, sessionKey)
    }

    // ─── 状态同步：完成处理 ─────────────────────────────────────
    if (stateUpdater) {
      const responseText = typeof finalContent === 'string' ? finalContent : ''
      stateUpdater.finishProcessing(sessionKey, responseText)
    }

    return {
      response: responseToReturn || '(no response)',
      toolCalls: toolCallNames,
      finished:
        toolCallNames.length >= maxRounds || (finalContent !== '' && toolCallNames.length === 0),
    }
  }

  /**
   * 流式运行
   */
  async *runStream(opts: RunOptions): AsyncGenerator<string | ContentBlock[], void, unknown> {
    const {
      agentId,
      sessionKey,
      userMessage,
      maxRounds = DEFAULT_MAX_ROUNDS,
      temperature,
      maxTokens,
      soul,
      systemPrompt,
      contextWindowSize = DEFAULT_CONTEXT_WINDOW,
    } = opts

    const sentinel = this.deps.sentinel
    const messageText =
      typeof userMessage === 'string'
        ? userMessage
        : userMessage.map((b) => (b.type === 'text' ? b.text : '')).join(' ')

    // ─── 输入扫描（同步） ─────────────────────────────────────
    if (sentinel) {
      const scanResult = sentinel.scanInput(messageText, sessionKey)
      if (!scanResult.pass) {
        const fallbackResponse = sentinel.scanInputWithTakeover(messageText, sessionKey)
        yield fallbackResponse.response!
        return
      }
    }

    // ─── 状态同步：开始处理 ─────────────────────────────────────
    let stateUpdater: StateUpdater | undefined
    if (sentinel) {
      stateUpdater = sentinel.createStateUpdater(agentId)
      stateUpdater.startProcessing(sessionKey, messageText)
    }

    const history = await this.deps.memory.getHistory(agentId, sessionKey)
    let messages: LLMMessage[] = [...history, { role: 'user', content: userMessage }]

    await this.deps.memory.append(agentId, sessionKey, 'user', userMessage)

    // Context Compression
    const totalTokens = estimateMessagesTokens(messages)
    if (totalTokens > contextWindowSize * 0.8) {
      messages = await compressMessages(messages, contextWindowSize, this.deps.llm, systemPrompt)
    }

    const toolCtx: ToolContext = { agentId, sessionKey, ipAddress: opts.ipAddress }

    for (let round = 0; round < maxRounds; round++) {
      const fullMessages = this.buildMessagesWithSystem(messages, soul, systemPrompt)

      // 流式输出
      let accumulated = ''
      for await (const chunk of this.deps.llm.chatStream(fullMessages, {
        temperature,
        maxTokens,
      })) {
        if (chunk.type === 'text' && chunk.content) {
          accumulated += chunk.content
          yield chunk.content
        }
      }

      messages.push({ role: 'assistant', content: accumulated })

      // 检查工具调用
      const toolCalls = this.deps.tools.parse(accumulated)
      if (toolCalls.length === 0) {
        await this.deps.memory.append(agentId, sessionKey, 'assistant', accumulated)

        // 输出扫描（异步）
        if (this.outputScanner) {
          this.outputScanner.scanAsync(accumulated, sessionKey)
        }

        // 状态同步：完成处理
        if (stateUpdater) {
          stateUpdater.finishProcessing(sessionKey, accumulated)
        }
        break
      }

      // 执行工具
      const results = await this.deps.tools.execute(toolCalls, toolCtx)
      const resultText = this.deps.tools.format(results)
      messages.push({ role: 'user', content: resultText })
    }
  }

  /**
   * 构建带 system prompt 的消息
   */
  private buildMessagesWithSystem(
    messages: LLMMessage[],
    soul?: { personality?: string; role?: string },
    systemPrompt?: string,
  ): LLMMessage[] {
    if (systemPrompt) {
      return [{ role: 'system', content: systemPrompt }, ...messages]
    }

    if (soul) {
      const parts: string[] = []
      if (soul.role) parts.push(`你是 ${soul.role}。`)
      if (soul.personality) parts.push(`\n## 性格\n${soul.personality}`)
      const system = parts.join('\n\n')
      if (system) {
        return [{ role: 'system', content: system }, ...messages]
      }
    }

    return messages
  }
}

export * from './types.js'
export { compressMessages, estimateMessagesTokens, estimateTokens } from '../compression.js'
