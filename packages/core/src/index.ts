/**
 * @colomind/core - Agent 运行时核心
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
  ColoMindRuntimeImpl,
  type RunOptions,
  type RunResult,
  type RuntimeDeps,
  type LLMProvider,
  type LLMResponse,
  type LLMStreamChunk,
  type MemoryStore,
  type ToolExecutor,
  type AuditLogger,
  type ResultPusher,
  type AuditEntry,
  // 新接口
  type ColoMindRuntime,
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
} from './runtime/index.js'

// 类型定义
export type {
  LLMMessage,
  LLMOptions,
  ContentBlock,
  ToolCall,
  ToolResult,
  ToolContext,
} from '@colomind/types'

// ═══════════════════════════════════════════════════════════════
// Provider 实现（按需使用）
// ═══════════════════════════════════════════════════════════════

export { OpenAIProvider, type OpenAIConfig } from './providers/openai.js'
export { AnthropicProvider, type AnthropicConfig } from './providers/anthropic.js'
export { MockProvider, type MockConfig } from './providers/mock.js'

// ═══════════════════════════════════════════════════════════════
// 适配器实现（按需使用）
// ═══════════════════════════════════════════════════════════════

export { InMemoryStore } from './adapters/memory.js'
export { DatabaseStore, type DatabaseStoreConfig } from './adapters/database-store.js'
export { SQLiteStore, createAutoStore, type SQLiteStoreConfig } from './adapters/sqlite-store.js'
export { ConsoleAudit, ConsolePusher, ToolExecutorImpl } from './adapters/index.js'
export { InMemoryStateStore, type StateStore } from './adapters/state.js'
export { LocalFileSystemAdapter, type FileSystemAdapter } from './adapters/filesystem.js'
export { ToolRegistry, toolRegistry } from './tools/registry.js'

// ═══════════════════════════════════════════════════════════════
// 工具系统（高层 API）
// ═══════════════════════════════════════════════════════════════

export { registerBuiltinTools, registerAllTools } from './tools/builtin.js'
export { registerLLMPoolTools } from './tools/llm-pool-tools.js'

export type { ToolPolicy } from './tools/executor.js'

// ═══════════════════════════════════════════════════════════════
// 大文件分块处理
// ═══════════════════════════════════════════════════════════════

export {
  readChunksByBytes,
  readChunksByLines,
  readChunksByTokens,
  mergeText,
  mergeArray,
  mergeStats,
  DEFAULT_CHUNK_CONFIG,
  type ChunkConfig,
  type Chunk,
  type ChunkResult,
} from './chunking/index.js'

// ═══════════════════════════════════════════════════════════════
// 任务拆解
// ═══════════════════════════════════════════════════════════════

export { breakdownTask } from './task-breakdown/index.js'

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
} from './config/index.js'

// ═══════════════════════════════════════════════════════════════
// 插件系统（扩展能力）
// ═══════════════════════════════════════════════════════════════

export { PluginManager, type Plugin, type PluginContext } from './plugins/index.js'

// ═══════════════════════════════════════════════════════════════
// 子智能体系统（高层 API）
// ═══════════════════════════════════════════════════════════════

export {
  spawnSubAgent,
  getSubAgent,
  listSubAgents,
  destroySubAgent,
  clearSubAgents,
  runSubAgentTask,
  setGlobalAllowedTools,
  getGlobalAllowedTools,
  isToolAllowed,
  type SubAgent,
  type SubAgentConfig,
} from './subagents/index.js'

// ═══════════════════════════════════════════════════════════════
// 搜索（高层 API）
// ═══════════════════════════════════════════════════════════════

export {
  search,
  academicSearch,
  configureSearch,
  type SearchOptions,
  type SearchResult,
} from './search.js'

// ═══════════════════════════════════════════════════════════════
// Skill 系统
// ═══════════════════════════════════════════════════════════════

export { listSkills, getSkillByName, executeSkill, type Skill } from './skill-runtime/index.js'

export {
  detectPatterns,
  evolveSkillFromConversation,
  type SkillProposal,
} from './skill-evolution/index.js'

// ═══════════════════════════════════════════════════════════════
// Trigger 系统
// ═══════════════════════════════════════════════════════════════

export {
  initTriggerEngine,
  createTrigger,
  stopTrigger,
  type Trigger,
} from './trigger-runtime/index.js'

// ═══════════════════════════════════════════════════════════════
// Agent 注册表
// ═══════════════════════════════════════════════════════════════

export { agentRegistry, type Agent, type AgentCreate, type AgentUpdate } from './agents/registry.js'

// ═══════════════════════════════════════════════════════════════
// 日志系统
// ═══════════════════════════════════════════════════════════════

export {
  Logger,
  createCliLogger,
  createTuiLogger,
  type LoggerConfig,
  type LogLevel,
} from './logger.js'

// ═══════════════════════════════════════════════════════════════
// Assistant 集成（可选）
// ═══════════════════════════════════════════════════════════════

export {
  loadUserContext,
  buildMessagesWithContext,
} from './assistant-integration.js'

// ═══════════════════════════════════════════════════════════════
// 视觉系统
// ═══════════════════════════════════════════════════════════════

export {
  analyzeImageLocal,
  analyzeImage,
  analyzeImageCached,
  configureLocalVision,
  clearVisionCache,
  type VisionAnalysisResult,
  type LocalVisionConfig,
} from './vision/index.js'

// ═══════════════════════════════════════════════════════════════
// Skills 技能
// ═══════════════════════════════════════════════════════════════

export {
  fetchWechatArticle,
  fetchAndSummarizeWechatArticle,
  registerWechatArticleTool,
  type WechatArticle,
  type WechatArticleOptions,
} from './skills/index.js'

// ═══════════════════════════════════════════════════════════════
// 健康检查
// ═══════════════════════════════════════════════════════════════

export {
  initHealthChecker,
  healthCheck,
  livenessCheck,
  readinessCheck,
  type HealthStatus,
  type HealthCheck,
  type HealthCheckerConfig,
} from './health/index.js'

// ═══════════════════════════════════════════════════════════════
// 配置存储（消费者版）
// ═══════════════════════════════════════════════════════════════

export {
  isConfigured,
  loadConfig,
  saveConfig,
  completeOnboarding,
  verifyAdminPassword,
  getConfigDir,
  getDbPath,
  resetConfig,
  exportConfig,
  type ColoMindConfig,
} from './config-store/index.js'

// ═══════════════════════════════════════════════════════════════
// 错误处理
// ═══════════════════════════════════════════════════════════════

export {
  AppError,
  UserError,
  AuthError,
  NotFoundError,
  RateLimitError,
  LLMError,
  DatabaseError,
  NetworkError,
  toAppError,
  getFriendlyMessage,
  errorHandler,
  ErrorCodes,
  type ErrorCategory,
} from './errors/index.js'

// ═══════════════════════════════════════════════════════════════
// 优雅关闭
// ═══════════════════════════════════════════════════════════════

export {
  GracefulShutdown,
  createGracefulShutdown,
  setupSimpleShutdown,
  type ShutdownOptions,
} from './shutdown/index.js'

// ═══════════════════════════════════════════════════════════════
// 数据操作（统一入口）
// ═══════════════════════════════════════════════════════════════

export {
  // Todo
  listTodos,
  getTodayTodos,
  createTodo,
  updateTodo,
  deleteTodo,
  completeTodo,
  // Reminder
  listReminders,
  createReminder,
  deleteReminder,
  completeReminder,
  // Event
  getDayEvents,
  getWeekEvents,
  getMonthEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  // Note
  listNotes,
  searchNotes,
  createNote,
  updateNote,
  deleteNote,
  // Habit
  listHabits,
  createHabit,
  deleteHabit,
  checkHabit,
  getHabitLogs,
  // Mood
  getMoodEntries,
  logMood,
  getMoodStats,
  // Finance
  getFinanceEntries,
  logFinance,
  getFinanceStats,
  getMonthlyStats,
  // Goal
  listGoals,
  createGoal,
  deleteGoal,
  updateGoalProgress,
  // Contact
  listContacts,
  searchContacts,
  createContact,
  updateContact,
  deleteContact,
  // Intent
  parseIntent,
  // User Profile
  generateUserProfile,
} from './data/index.js'

// ═══════════════════════════════════════════════════════════════
// LLM 抽象层
// ═══════════════════════════════════════════════════════════════

export {
  chat,
  agentChat,
  chatStream,
  agentChatStream,
  chatWithConfig,
  type LLMConfig,
  llmPool,
  LLMPool,
  type ProviderInstance,
  type ProviderType,
} from './llm/index.js'

// ═══════════════════════════════════════════════════════════════
// Memory 系统
// ═══════════════════════════════════════════════════════════════

export {
  // DB
  initDb,
  query,
  queryOne,
  closeDb,
  getPool,
  type DbConfig,
  // Embeddings
  embed,
  configureEmbedding,
  type EmbeddingConfig,
  // Vector Memory
  addMemory,
  searchMemory,
  searchMemoryText,
  listMemory,
  hybridSearch,
  // Layered Memory
  initLayeredMemoryTables,
  addLongTermMemory,
  searchLongTermMemory,
  getUserProfile as getMemoryUserProfile,
  addEpisodicMemory,
  searchEpisodicMemory,
  applyDecay,
  addWorkingMemory,
  getWorkingMemory,
  clearWorkingMemory,
  searchAllMemory,
  getMemoryContext,
  type MemoryLayer,
  type LongTermType,
  type LongTermMemory,
  type EpisodicMemory,
  type WorkingMemory,
  type MemorySearchResult,
} from './memory/index.js'

// ═══════════════════════════════════════════════════════════════
// 语义空间记忆系统
// ═══════════════════════════════════════════════════════════════

export {
  SpaceMemoryService,
  createSpaceMemoryService,
  SpaceStore,
  SpaceEngine,
  cosineSimilarity,
  cosineDistance,
  findNearestRoom,
  updateCentroid,
  kMeansSplit,
  memoryStrength,
  rankByStrength,
  shouldArchive,
  nextReviewTime,
} from './memory/space/index.js'

// ═══════════════════════════════════════════════════════════════
// Services
// ═══════════════════════════════════════════════════════════════

export {
  // Knowledge
  addKnowledge,
  getKnowledge,
  listKnowledge,
  searchKnowledge,
  deleteKnowledge,
  type KnowledgeCategory,
  type KnowledgeEntry,
  // User Profile
  getUserProfile,
  upsertUserProfile,
  deleteUserProfile,
  buildProfilePrompt,
  getProfileSummary,
  type UserRole,
  type ExpertiseLevel,
  type UserProfile,
  type ProfileUpdate,
} from './services/index.js'

// ═══════════════════════════════════════════════════════════════
// 网关层
// ═══════════════════════════════════════════════════════════════

export {
  Gateway,
  createHonoApp,
  type GatewayConfig,
  type DeviceInfo,
  type DeviceBinding,
  type GatewayContext,
  type GatewayRequest,
  type GatewayResponse,
  type Middleware,
  type RateLimitPreset,
  DEFAULT_GATEWAY_CONFIG,
  RATE_LIMIT_PRESETS,
} from './gateway/index.js'
