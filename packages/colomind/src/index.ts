/**
 * ColoMind - TypeScript AI Agent Framework
 *
 * 伞包，重新导出所有子模块
 */

// Core - 主要功能
export {
  AgentRuntime,
  OpenAIProvider,
  AnthropicProvider,
  MockProvider,
  SQLiteStore,
  ToolRegistry,
} from '@colomind/core'

// Sentinel - 安全守护
export {
  Sentinel,
  RuleEngine,
  InferenceAgent,
  LegalGuidanceGenerator,
  LegalLearner,
  getSentinel,
} from '@colomind/sentinel'

// Charter - 许可证管理
export { CharterManager } from '@colomind/charter'

// Types - 核心类型
export type {
  LLMMessage,
  LLMOptions,
  ContentBlock,
  ToolCall,
  ToolResult,
} from '@colomind/types'

// 版本信息
export const VERSION = '0.3.1'
