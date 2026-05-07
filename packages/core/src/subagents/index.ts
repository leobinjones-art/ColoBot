/**
 * 子智能体系统
 * 父 Agent 负责任务分解 + 成果审核 + 用户展示
 * 子 Agent 负责执行层（受限权限、TTL、工具白名单）
 */

import type { LLMMessage, ContentBlock, ToolContext } from '@nexusmind/types'
import type { LLMProvider, AuditLogger } from '../runtime/types.js'

/** 简化的工具调用（子 Agent 内部使用） */
export interface SimpleToolCall {
  name: string
  args: Record<string, unknown>
}

/** 简化的工具结果（子 Agent 内部使用） */
export interface SimpleToolResult {
  name: string
  result?: unknown
  error?: string
}

export interface SubAgentConfig {
  name: string
  soulContent: string
  parentId: string
  ttlMs?: number
  allowedTools?: string[]
  fallbackModelId?: string
  workspacePath?: string
  taskTimeoutMs?: number
  maxRetries?: number
}

export interface SubAgent {
  id: string
  name: string
  soulContent: string
  parentId: string
  allowedTools: string[]
  workspacePath: string
  createdAt: number
  expiresAt: number
  status: 'idle' | 'busy' | 'done' | 'timeout' | 'error'
  fallbackModelId?: string
  taskTimeoutMs?: number
  maxRetries: number
}

/**
 * 子 Agent 任务句柄
 */
export interface SubAgentTask {
  id: string
  subAgentId: string
  task: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'cancelled'
  result?: string
  error?: string
  startTime: number
  endTime?: number
  retries: number
  maxRetries: number
}

export interface SubAgentDeps {
  llm: LLMProvider
  audit: AuditLogger
  parseTools: (content: string) => SimpleToolCall[]
  executeTools: (calls: SimpleToolCall[], context: ToolContext) => Promise<SimpleToolResult[]>
  formatResults: (results: SimpleToolResult[]) => string
}

// ── 并发限制 ──────────────────────────────────────────────
// 当前架构：单父 Agent，不存在多智能体
// 全局限制 = 单父限制 = 10
const MAX_CONCURRENT_SUBAGENTS = 10
const DEFAULT_TTL_MS = 5 * 60 * 1000
const DEFAULT_TASK_TIMEOUT_MS = 5 * 60 * 1000
const DEFAULT_MAX_RETRIES = 2
const CLEANUP_INTERVAL = 30_000

// ── 全局默认工具白名单 ──────────────────────────────────────────────
let globalAllowedTools: string[] = [
  'read_file',
  'write_file',
  'list_dir',
  'web_search',
  'python',
  'http',
]

/**
 * 设置全局默认工具白名单
 */
export function setGlobalAllowedTools(tools: string[]): void {
  globalAllowedTools = tools
}

/**
 * 获取全局默认工具白名单
 */
export function getGlobalAllowedTools(): string[] {
  return [...globalAllowedTools]
}

const subAgents = new Map<string, SubAgent>()
const tasks = new Map<string, SubAgentTask>()
let cleanupTimer: ReturnType<typeof setInterval> | null = null

function countBusy(): number {
  let count = 0
  for (const a of subAgents.values()) {
    if (a.status === 'busy') count++
  }
  return count
}

function checkConcurrency(): void {
  if (countBusy() >= MAX_CONCURRENT_SUBAGENTS) {
    throw new Error(`子Agent并发已达上限(${MAX_CONCURRENT_SUBAGENTS})，请稍后再试`)
  }
}

function startCleanup(): void {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [id, agent] of subAgents) {
      if (now > agent.expiresAt) {
        console.log(`[SubAgent] Expired: ${agent.name} (${id})`)
        subAgents.delete(id)
      }
    }
  }, CLEANUP_INTERVAL)
}

/**
 * 创建子 Agent
 */
export function spawnSubAgent(config: SubAgentConfig): SubAgent {
  startCleanup()
  checkConcurrency()

  const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const ttlMs = config.ttlMs ?? DEFAULT_TTL_MS
  const now = Date.now()
  const workspacePath = config.workspacePath ?? `/workspace/${config.name}`

  const agent: SubAgent = {
    id,
    name: config.name,
    soulContent: config.soulContent,
    parentId: config.parentId,
    allowedTools: config.allowedTools ?? globalAllowedTools,
    workspacePath,
    createdAt: now,
    expiresAt: now + ttlMs,
    status: 'idle',
    fallbackModelId: config.fallbackModelId,
    taskTimeoutMs: config.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS,
    maxRetries: config.maxRetries ?? DEFAULT_MAX_RETRIES,
  }

  subAgents.set(id, agent)
  console.log(
    `[SubAgent] Spawned: ${agent.name} (${id}) parent=${config.parentId} workspace=${workspacePath} ttl=${ttlMs}ms`,
  )
  return agent
}

/**
 * 获取子 Agent
 */
export function getSubAgent(id: string): SubAgent | undefined {
  return subAgents.get(id)
}

/**
 * 列出父 Agent 的所有子 Agent
 */
export function listSubAgents(parentId: string): SubAgent[] {
  return Array.from(subAgents.values()).filter((a) => a.parentId === parentId)
}

/**
 * 销毁子 Agent
 */
export function destroySubAgent(id: string, parentId: string): boolean {
  const agent = subAgents.get(id)
  if (!agent) return false
  if (agent.parentId !== parentId) {
    console.warn(`[SubAgent] Unauthorized destroy: ${id} by ${parentId}`)
    return false
  }
  subAgents.delete(id)
  console.log(`[SubAgent] Destroyed: ${agent.name} (${id})`)
  return true
}

/**
 * 设置子 Agent 状态
 */
export function setSubAgentStatus(id: string, status: SubAgent['status']): void {
  const agent = subAgents.get(id)
  if (agent) agent.status = status
}

/**
 * 延长子 Agent 过期时间
 */
export function touchSubAgent(id: string, extraMs = 60_000): boolean {
  const agent = subAgents.get(id)
  if (!agent) return false
  agent.expiresAt = Date.now() + extraMs
  return true
}

/**
 * 检查工具是否允许
 */
export function isToolAllowed(subAgentId: string, toolName: string): boolean {
  const agent = subAgents.get(subAgentId)
  if (!agent) return false
  return agent.allowedTools.includes(toolName)
}

/**
 * 获取子 Agent 工作区路径
 */
export function getSubAgentWorkspacePath(subAgentId: string): string | null {
  const agent = subAgents.get(subAgentId)
  return agent?.workspacePath ?? null
}

/**
 * 构建子 Agent 系统提示
 */
function buildSubAgentSystemPrompt(soul: {
  role?: string
  personality?: string
  rules?: string[]
  skills?: string[]
}): string {
  const parts: string[] = [`你是 ${soul.role || '助手'}。`]
  if (soul.personality) parts.push(`\n## 性格\n${soul.personality}`)
  if (soul.rules?.length) parts.push(`\n## 规则\n${soul.rules.map((r) => `- ${r}`).join('\n')}`)
  if (soul.skills?.length) parts.push(`\n## 技能\n${soul.skills.map((s) => `- ${s}`).join('\n')}`)
  return parts.join('\n')
}

/**
 * 运行子 Agent 任务
 */
export async function runSubAgentTask(
  subAgent: SubAgent,
  task: string,
  parentId: string,
  deps: SubAgentDeps,
): Promise<string> {
  if (subAgent.parentId !== parentId) {
    throw new Error('Unauthorized: parent mismatch')
  }

  touchSubAgent(subAgent.id, 60_000)
  setSubAgentStatus(subAgent.id, 'busy')

  // 审计：任务开始
  await deps.audit
    .write({
      actorType: 'agent',
      actorId: subAgent.id,
      actorName: subAgent.name,
      action: 'subagent.task.start',
      targetType: 'task',
      targetId: subAgent.id,
      detail: { taskLength: task.length, parentId },
      result: 'success',
    })
    .catch((e) => console.error('[SubAgent] audit error:', e))

  try {
    const soul = JSON.parse(subAgent.soulContent || '{}')
    const maxRounds = 5
    const timeoutMs = subAgent.taskTimeoutMs ?? DEFAULT_TASK_TIMEOUT_MS

    const messages: LLMMessage[] = [
      { role: 'system', content: buildSubAgentSystemPrompt(soul) },
      { role: 'user', content: task },
    ]

    let finalContent = ''

    for (let round = 0; round < maxRounds; round++) {
      // LLM 调用加超时
      const response = await Promise.race([
        deps.llm.chat(messages, {}),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM调用超时')), timeoutMs),
        ),
      ])

      const rawContent = response.content
      const rawText =
        typeof rawContent === 'string'
          ? rawContent
          : rawContent
              .map((b: ContentBlock) => (b.type === 'text' ? b.text : `[${b.type}]`))
              .join(' ')

      const toolCalls = deps.parseTools(rawText)

      if (toolCalls.length === 0) {
        finalContent = rawText
        messages.push({ role: 'assistant', content: rawContent })
        break
      }

      messages.push({ role: 'assistant', content: rawContent })

      // 工具白名单过滤
      const allowedCalls = toolCalls.filter((call) => isToolAllowed(subAgent.id, call.name))
      const blockedCalls = toolCalls.filter((call) => !isToolAllowed(subAgent.id, call.name))

      // 注入 sub_agent_id 到工具参数
      for (const call of allowedCalls) {
        call.args.sub_agent_id = subAgent.id
      }

      const toolCtx: ToolContext = { agentId: subAgent.id, sessionKey: '' }
      const executed = await deps.executeTools(allowedCalls, toolCtx)
      const toolResultText = deps.formatResults(executed)

      // 审计：工具执行
      for (const call of allowedCalls) {
        const exec = executed.find((e) => e.name === call.name)
        await deps.audit
          .write({
            actorType: 'agent',
            actorId: subAgent.id,
            actorName: subAgent.name,
            action: 'tool.execute',
            targetType: 'tool',
            targetId: call.name,
            detail: { args: call.args, result: exec?.result },
            result: exec ? 'success' : 'failure',
            errorMessage: exec?.error,
          })
          .catch(() => {})
      }

      // 审计：工具拦截
      for (const call of blockedCalls) {
        await deps.audit
          .write({
            actorType: 'agent',
            actorId: subAgent.id,
            actorName: subAgent.name,
            action: 'tool.blocked',
            targetType: 'tool',
            targetId: call.name,
            detail: { args: call.args },
            result: 'blocked',
            errorMessage: 'Tool not allowed',
          })
          .catch(() => {})
      }

      const blockedText =
        blockedCalls.length > 0
          ? `\n[Blocked: ${blockedCalls.map((c) => c.name).join(', ')} not allowed]`
          : ''

      messages.push({ role: 'user', content: `${toolResultText}${blockedText}` })
      finalContent = rawText
    }

    setSubAgentStatus(subAgent.id, 'done')
    await deps.audit
      .write({
        actorType: 'agent',
        actorId: subAgent.id,
        actorName: subAgent.name,
        action: 'subagent.task.complete',
        targetType: 'task',
        targetId: subAgent.id,
        detail: { rounds: maxRounds },
        result: 'success',
      })
      .catch(() => {})

    return finalContent || '(无回复)'
  } catch (e) {
    const isTimeout = String(e).includes('超时')
    setSubAgentStatus(subAgent.id, isTimeout ? 'timeout' : 'error')
    await deps.audit
      .write({
        actorType: 'agent',
        actorId: subAgent.id,
        actorName: subAgent.name,
        action: isTimeout ? 'subagent.task.timeout' : 'subagent.task.error',
        targetType: 'task',
        targetId: subAgent.id,
        detail: {},
        result: 'failure',
        errorMessage: String(e),
      })
      .catch(() => {})
    throw e
  }
}

/**
 * 清理所有子 Agent（测试用）
 */
export function clearSubAgents(): void {
  subAgents.clear()
  tasks.clear()
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}

// ── Task 句柄管理 ──────────────────────────────────────────────

/**
 * 创建任务句柄
 */
function createTask(subAgentId: string, task: string, maxRetries: number): SubAgentTask {
  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const taskHandle: SubAgentTask = {
    id: taskId,
    subAgentId,
    task,
    status: 'pending',
    startTime: Date.now(),
    retries: 0,
    maxRetries,
  }
  tasks.set(taskId, taskHandle)
  return taskHandle
}

/**
 * 获取任务状态
 */
export function getTaskStatus(taskId: string): SubAgentTask | undefined {
  return tasks.get(taskId)
}

/**
 * 获取子 Agent 的所有任务
 */
export function getSubAgentTasks(subAgentId: string): SubAgentTask[] {
  return Array.from(tasks.values()).filter((t) => t.subAgentId === subAgentId)
}

/**
 * 取消任务
 */
export function cancelTask(taskId: string): boolean {
  const task = tasks.get(taskId)
  if (!task) return false
  if (task.status === 'completed') return false

  task.status = 'cancelled'
  task.endTime = Date.now()
  console.log(`[SubAgent] Task cancelled: ${taskId}`)
  return true
}

/**
 * 等待任务完成
 */
export async function awaitTask(taskId: string, timeoutMs?: number): Promise<string> {
  const task = tasks.get(taskId)
  if (!task) throw new Error(`Task not found: ${taskId}`)

  const deadline = timeoutMs ? Date.now() + timeoutMs : Infinity

  while (Date.now() < deadline) {
    const current = tasks.get(taskId)
    if (!current) throw new Error(`Task disappeared: ${taskId}`)

    if (current.status === 'completed') {
      return current.result ?? ''
    }
    if (current.status === 'failed' || current.status === 'timeout') {
      throw new Error(current.error ?? 'Task failed')
    }
    if (current.status === 'cancelled') {
      throw new Error('Task cancelled')
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  // 超时
  cancelTask(taskId)
  throw new Error(`Await timeout (${timeoutMs}ms)`)
}

/**
 * 重试任务
 */
export async function retryTask(taskId: string, deps: SubAgentDeps): Promise<SubAgentTask> {
  const task = tasks.get(taskId)
  if (!task) throw new Error(`Task not found: ${taskId}`)

  if (task.retries >= task.maxRetries) {
    throw new Error(`Max retries (${task.maxRetries}) exceeded`)
  }

  const subAgent = subAgents.get(task.subAgentId)
  if (!subAgent) throw new Error(`SubAgent not found: ${task.subAgentId}`)

  // 重置状态
  task.status = 'pending'
  task.error = undefined
  task.result = undefined
  task.startTime = Date.now()
  task.endTime = undefined
  task.retries++

  console.log(`[SubAgent] Retrying task ${taskId} (attempt ${task.retries + 1})`)

  // 重新执行
  return executeTaskInternal(task, subAgent, deps)
}

/**
 * 执行任务（带重试）
 */
export async function executeTaskWithRetry(
  subAgent: SubAgent,
  task: string,
  parentId: string,
  deps: SubAgentDeps,
): Promise<SubAgentTask> {
  const taskHandle = createTask(subAgent.id, task, subAgent.maxRetries)

  return executeTaskInternal(taskHandle, subAgent, deps)
}

/**
 * 内部任务执行
 */
async function executeTaskInternal(
  taskHandle: SubAgentTask,
  subAgent: SubAgent,
  deps: SubAgentDeps,
): Promise<SubAgentTask> {
  taskHandle.status = 'running'

  try {
    const result = await runSubAgentTask(subAgent, taskHandle.task, subAgent.parentId, deps)

    taskHandle.status = 'completed'
    taskHandle.result = result
    taskHandle.endTime = Date.now()

    return taskHandle
  } catch (e) {
    const isTimeout = String(e).includes('超时') || String(e).includes('timeout')

    taskHandle.status = isTimeout ? 'timeout' : 'failed'
    taskHandle.error = String(e)
    taskHandle.endTime = Date.now()

    // 自动重试
    if (taskHandle.retries < taskHandle.maxRetries) {
      console.log(`[SubAgent] Auto-retrying task ${taskHandle.id}`)
      return retryTask(taskHandle.id, deps)
    }

    return taskHandle
  }
}
