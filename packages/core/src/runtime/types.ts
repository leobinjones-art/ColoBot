/**
 * Agent 运行时核心 - 抽象层
 */

import type {
  LLMMessage,
  LLMOptions,
  ContentBlock,
  ToolCall,
  ToolResult,
  ToolContext,
  LLMProvider,
  LLMResponse,
  LLMStreamChunk,
} from '@colomind/types'
import type { Sentinel } from '@colomind/sentinel'

// Re-export LLM types from @colomind/types for backward compatibility
export type { LLMProvider, LLMResponse, LLMStreamChunk }

/**
 * 记忆存储接口
 */
export interface MemoryStore {
  append(agentId: string, sessionKey: string, role: string, content: unknown): Promise<void>
  getHistory(agentId: string, sessionKey: string): Promise<LLMMessage[]>
  clear(agentId: string, sessionKey: string): Promise<void>
}

/**
 * 工具执行器接口
 */
export interface ToolExecutor {
  parse(content: string): ToolCall[]
  execute(calls: ToolCall[], context: ToolContext): Promise<ToolResult[]>
  format(results: ToolResult[]): string
  getTools?(): Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, unknown>
    }
  }>
}

/**
 * 审计日志接口
 */
export interface AuditLogger {
  write(entry: AuditEntry): Promise<void>
}

export interface AuditEntry {
  actorType: 'user' | 'agent' | 'system'
  actorId: string
  actorName?: string
  action: string
  targetType: string
  targetId: string
  detail?: Record<string, unknown>
  ipAddress?: string
  result: 'success' | 'failure' | 'blocked'
  errorMessage?: string
}

/**
 * 推送接口
 */
export interface ResultPusher {
  pushResult(agentId: string, sessionKey: string, content: unknown): void
  pushChunk(agentId: string, sessionKey: string, chunk: string): void
  pushDone(agentId: string, sessionKey: string): void
}

/**
 * Agent 运行时依赖
 */
export interface RuntimeDeps {
  llm: LLMProvider
  memory: MemoryStore
  tools: ToolExecutor
  audit: AuditLogger
  pusher: ResultPusher
  sentinel?: Sentinel // 可选：安全守护母 Agent
}
