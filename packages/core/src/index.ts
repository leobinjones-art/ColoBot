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
  type SearchOptions,
  type SearchResult,
  type SearchResponse,
  type AcademicPaper,
} from './search.js';