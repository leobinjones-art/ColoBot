/**
 * ColoBot - 自带安全守护的 AI Agent 框架
 *
 * 这是伞包，重新导出所有子包的功能
 */

// Core - 核心运行时
export { AgentRuntime } from '@nexusmind/core'
export type { RunOptions, RunResult, AgentConfig } from '@nexusmind/core'

// Core - Providers
export { OpenAIProvider, AnthropicProvider, MockProvider, MiniMaxProvider } from '@nexusmind/core'
export type { LLMProvider, LLMResponse } from '@nexusmind/core'

// Core - Tools
export { ToolRegistry } from '@nexusmind/core'
export type { ToolContext, ToolResult } from '@nexusmind/types'

// Core - Memory
export { SQLiteStore, createAutoStore } from '@nexusmind/core'

// Core - Config
export { ConfigManager } from '@nexusmind/core'
export type { CoreConfig } from '@nexusmind/core'

// Core - Health & Shutdown
export { HealthCheck } from '@nexusmind/core'
export { GracefulShutdown } from '@nexusmind/core'

// Sentinel - 安全守护
export { Sentinel, CharterGuard } from '@nexusmind/sentinel'
export type { SentinelConfig } from '@nexusmind/sentinel'

// Charter - 许可证系统
export {
  CharterManager,
  ACADEMIC_CHARTER,
  LEGAL_CHARTER,
  LONGDOC_CHARTER,
} from '@nexusmind/charter'
export type { CharterDefinition, CharterInstance } from '@nexusmind/charter'

// Types - 共享类型
export type { LLMMessage, ContentBlock, TextContent, ToolCall, Skill } from '@nexusmind/types'
