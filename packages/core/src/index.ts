/**
 * @colobot/core - Agent 运行时核心
 */

// 插件系统
export * from './plugins/index.js';

// 运行时
export { AgentRuntime, type RuntimeDeps, type LLMProvider, type LLMResponse, type LLMStreamChunk, type MemoryStore, type ToolExecutor, type AuditLogger, type ResultPusher } from './runtime/index.js';

// 工具系统
export * from './tools/index.js';

// Provider 实现
export * from './providers/index.js';

// 适配器实现
export * from './adapters/index.js';

// 内存存储
export * from './memory/index.js';

// 内容安全
export { ContentScanner, detectThreat, buildUninstallConfirmPrompt, type ScanResult, type ContentScannerConfig, type ThreatResult } from './content/scanner.js';
export {
  determineTrustLevel,
  canWrite,
  validateContent,
  detectPoisoning,
  recordPoisoningAttempt,
  type ContentSource,
  type ContentValidationResult,
  type PoisoningAttempt,
} from './content/poison-defense.js';

// 审批流程
export * from './approval/index.js';

// 上下文压缩
export { compressMessages, estimateTokens, estimateMessagesTokens } from './compression.js';

// 搜索
export {
  search,
  imageSearch,
  videoSearch,
  newsSearch,
  multimodalSearch,
  academicSearch,
  configureSearch,
  getSearchConfig,
  type SearchOptions,
  type SearchResult,
  type SearchResponse,
  type AcademicPaper,
} from './search.js';

// 子智能体系统
export {
  spawnSubAgent,
  getSubAgent,
  listSubAgents,
  destroySubAgent,
  setSubAgentStatus,
  touchSubAgent,
  isToolAllowed,
  getSubAgentWorkspacePath,
  runSubAgentTask,
  clearSubAgents,
  setGlobalAllowedTools,
  getGlobalAllowedTools,
  type SubAgentConfig,
  type SubAgent,
  type SubAgentDeps,
} from './subagents/index.js';

// 任务拆解 - AI驱动的动态任务分解
export {
  analyzeRequest,
  executeDynamicTask,
  cleanupTaskResult,
  DEFAULT_TOOLS,
  type ToolDefinition,
  type TaskAnalysis,
  type SubTask,
  type ExecutionResult,
  type TaskResult,
  type ExecutionContext,
  type DynamicBreakdownDeps,
} from './task-breakdown/index.js';

// 大文件处理 - 分块、流式、合并
export {
  getFileInfo,
  readChunksByBytes,
  readChunksByLines,
  readChunksByTokens,
  processChunksParallel,
  processStream,
  processWithSlidingWindow,
  compressWithLLM,
  hierarchicalSummary,
  mergeText,
  mergeArray,
  mergeStats,
  mergeDedup,
  CHUNK_TOOLS,
  DEFAULT_CHUNK_CONFIG,
  type ChunkConfig,
  type Chunk,
  type ChunkResult,
  type FileInfo,
  type ChunkProcessor,
  type StreamProcessor,
  type WindowProcessor,
  type MergeStrategy,
} from './chunking/index.js';

// 配置管理 - 命令行配置系统
export {
  ConfigManager,
  DEFAULT_CONFIG,
  initConfig,
  getConfigManager,
  parseCLIArgs,
  applyCLIOptions,
  HELP_TEXT,
  getModelCapabilities,
  type CoreConfig,
  type ModelConfig,
  type SearchConfig,
  type ModelCapabilities,
  type CLIOptions,
} from './config/index.js';
export type { SubAgentConfig as SubAgentConfigFromCore } from './config/index.js';