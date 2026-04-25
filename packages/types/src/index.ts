/**
 * @colobot/types - 共享类型定义
 */

// LLM
export type {
  TextContent,
  ImageUrlContent,
  AudioContent,
  ContentBlock,
  LLMMessage,
  LLMOptions,
  ToolDefinition,
  ModelConfig,
  LLMConfig,
} from './llm.js';

// Agent
export type {
  SubAgentType,
  SubAgentConfig,
  Skill,
  ApprovalStatus,
  ApprovalRequest,
} from './agent.js';

// Memory
export type {
  EmbedResult,
  MemoryResult,
  KnowledgeCategory,
  KnowledgeEntry,
} from './memory.js';

// Channel
export type {
  ChannelMessage,
  ChannelAdapter,
} from './channel.js';

// SOP
export type {
  SopStep,
  SopState,
  TaskAnalysis,
  SopPromptName,
} from './sop.js';

// Service
export type {
  UserRole,
  ExpertiseLevel,
  UserProfile,
  TrustLevel,
  ContentSource,
  ContentValidationResult,
  NotificationPayload,
  NotificationAdapter,
  AuditEntry,
  AppSetting,
} from './service.js';

// Tool
export type {
  ToolCall,
  ToolResult,
  ToolContext,
  RuntimeTool,
} from './tool.js';
