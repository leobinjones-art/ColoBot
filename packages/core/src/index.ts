/**
 * @colobot/core - Agent 运行时核心
 *
 * 设计原则：
 * - 只导出接口定义和高层 API
 * - 底层实现细节不导出
 * - 插件通过接口使用 core
 */

// ═══════════════════════════════════════════════════════════════
// 核心接口定义（必须导出）
// ═══════════════════════════════════════════════════════════════

// 运行时接口
export {
  AgentRuntime,
  ColoBotRuntimeImpl,
  type RunOptions,
  type RunResult,
  type RuntimeDeps,
  type LLMProvider,
  type LLMResponse,
  type LLMStreamChunk,
  type MemoryStore,
  type ToolExecutor,
  type ContentScanner,
  type AuditLogger,
  type ResultPusher,
  type ScanResult,
  type AuditEntry,
  // 新接口
  type ColoBotRuntime,
  type RuntimeDependencies,
  type ChatOptions,
  type AgentConfig,
  type AgentInfo,
  type MemoryResult,
  type StateFilter,
  type ApprovalFilter,
  type Approval,
  type AuditFilter,
  type AuditLog,
} from './runtime/index.js';

// 类型定义
export type {
  LLMMessage,
  LLMOptions,
  ContentBlock,
  ToolCall,
  ToolResult,
  ToolContext,
} from '@colobot/types';

// ═══════════════════════════════════════════════════════════════
// Provider 实现（按需使用）
// ═══════════════════════════════════════════════════════════════

export { OpenAIProvider, type OpenAIConfig } from './providers/openai.js';
export { AnthropicProvider, type AnthropicConfig } from './providers/anthropic.js';
export { MiniMaxProvider, type MiniMaxConfig } from './providers/minimax.js';
export { MockProvider, type MockConfig } from './providers/mock.js';

// ═══════════════════════════════════════════════════════════════
// 适配器实现（按需使用）
// ═══════════════════════════════════════════════════════════════

export { InMemoryStore } from './adapters/memory.js';
export { DatabaseStore, type DatabaseStoreConfig } from './adapters/database-store.js';
export { SQLiteStore, createAutoStore, type SQLiteStoreConfig } from './adapters/sqlite-store.js';
export { NoOpScanner } from './adapters/scanner.js';
export { ConsoleAudit, ConsolePusher } from './adapters/index.js';
export { InMemoryStateStore, type StateStore } from './adapters/state.js';
export { LocalFileSystemAdapter, type FileSystemAdapter } from './adapters/filesystem.js';
export { ToolRegistry, toolRegistry } from './tools/registry.js';

// ═══════════════════════════════════════════════════════════════
// 工具系统（高层 API）
// ═══════════════════════════════════════════════════════════════

export {
  registerBuiltinTools,
  registerAllTools,
} from './tools/builtin.js';

export type {
  ToolPolicy,
} from './tools/executor.js';

// ═══════════════════════════════════════════════════════════════
// 配置管理
// ═══════════════════════════════════════════════════════════════

export {
  ConfigManager,
  DEFAULT_CONFIG,
  initConfig,
  getConfigManager,
  type CoreConfig,
  type ModelConfig,
  type SearchConfig,
} from './config/index.js';

// ═══════════════════════════════════════════════════════════════
// 插件系统（扩展能力）
// ═══════════════════════════════════════════════════════════════

export {
  PluginManager,
  type Plugin,
  type PluginContext,
} from './plugins/index.js';

// ═══════════════════════════════════════════════════════════════
// 子智能体系统（高层 API）
// ═══════════════════════════════════════════════════════════════

export {
  spawnSubAgent,
  getSubAgent,
  listSubAgents,
  destroySubAgent,
  runSubAgentTask,
  setGlobalAllowedTools,
  getGlobalAllowedTools,
  type SubAgent,
  type SubAgentConfig,
} from './subagents/index.js';

// ═══════════════════════════════════════════════════════════════
// 搜索（高层 API）
// ═══════════════════════════════════════════════════════════════

export {
  search,
  academicSearch,
  configureSearch,
  type SearchOptions,
  type SearchResult,
} from './search.js';

// ═══════════════════════════════════════════════════════════════
// Skill 系统
// ═══════════════════════════════════════════════════════════════

export {
  listSkills,
  getSkillByName,
  executeSkill,
  type Skill,
} from './skill-runtime/index.js';

export {
  detectPatterns,
  evolveSkillFromConversation,
  type SkillProposal,
} from './skill-evolution/index.js';

// ═══════════════════════════════════════════════════════════════
// Trigger 系统
// ═══════════════════════════════════════════════════════════════

export {
  initTriggerEngine,
  createTrigger,
  stopTrigger,
  type Trigger,
} from './trigger-runtime/index.js';

// ═══════════════════════════════════════════════════════════════
// Agent 注册表
// ═══════════════════════════════════════════════════════════════

export {
  agentRegistry,
  type Agent,
  type AgentCreate,
  type AgentUpdate,
} from './agents/registry.js';
