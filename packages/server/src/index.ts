/**
 * @colobot/server - 完整服务整合包
 *
 * 整合 @colobot/core + @colobot/tui + @colobot/types
 * 提供一键启动的 ColoBot 服务
 */

// 核心模块
export {
  // 配置
  ConfigManager,
  initConfig,
  DEFAULT_CONFIG,
  getModelCapabilities,
  parseCLIArgs,
  applyCLIOptions,
  HELP_TEXT,
  type CLIOptions,
  type ModelConfig,
  type SearchConfig,

  // 运行时
  AgentRuntime,
  type RuntimeDeps,
  type LLMProvider,
  type LLMResponse,

  // LLM Provider
  OpenAIProvider,
  AnthropicProvider,

  // 工具
  ToolRegistry,
  toolRegistry,
  registerBuiltinTools,
  type ToolExecutor,
  type ToolResult,

  // 子 Agent
  spawnSubAgent,
  getSubAgent,
  destroySubAgent,
  listSubAgents,
  clearSubAgents,
  runSubAgentTask,
  setGlobalAllowedTools,
  getGlobalAllowedTools,
  isToolAllowed,
  type SubAgent,

  // 任务拆解
  analyzeRequest,
  executeDynamicTask,
  cleanupTaskResult,
  DEFAULT_TOOLS,
  type TaskAnalysis,
  type SubTask,
  type ExecutionResult,
  type TaskResult,

  // 分块
  readChunksByBytes,
  readChunksByLines,
  readChunksByTokens,
  processChunksParallel,
  mergeText,
  mergeArray,
  mergeStats,
  DEFAULT_CHUNK_CONFIG,
  type ChunkConfig,
  type ChunkResult,

  // 搜索
  search,
  configureSearch,
  type SearchResult,

  // 适配器
  InMemoryStore,
  ConsoleAudit,
  ConsolePusher,
  ToolExecutorImpl,
  NoOpScanner,
} from '@colobot/core';

// TUI 组件
export {
  TUI,
  ChatUI,
  CommandPalette,
  StatusBar,
  LogPanel,
  style,
  colors,
  clear,
  printTitle,
  printTable,
  progressBar,
  printError,
  printSuccess,
  printWarning,
  createInput,
  ask,
  confirm,
  select,
} from '@colobot/tui';

// 类型
export type {
  LLMMessage,
  ContentBlock,
  TextContent,
  ToolCall,
  ToolContext,
} from '@colobot/types';

// 服务启动函数
export { startColoBot, createRuntime } from './server.js';
