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
} from '@colobot/types';

/**
 * LLM 提供者接口
 */
export interface LLMProvider {
  name: string;
  chat(messages: LLMMessage[], options?: LLMOptions): Promise<LLMResponse>;
  chatStream(messages: LLMMessage[], options?: LLMOptions): AsyncIterable<LLMStreamChunk>;
}

export interface LLMResponse {
  content: string | ContentBlock[];
  toolCalls?: ToolCall[];
  usage?: { inputTokens: number; outputTokens: number };
}

export interface LLMStreamChunk {
  type: 'text' | 'tool_call' | 'done';
  content?: string;
  toolCall?: ToolCall;
}

/**
 * 记忆存储接口
 */
export interface MemoryStore {
  append(agentId: string, sessionKey: string, role: string, content: unknown): Promise<void>;
  getHistory(agentId: string, sessionKey: string): Promise<LLMMessage[]>;
  clear(agentId: string, sessionKey: string): Promise<void>;
}

/**
 * 工具执行器接口
 */
export interface ToolExecutor {
  parse(content: string): ToolCall[];
  execute(calls: ToolCall[], context: ToolContext): Promise<ToolResult[]>;
  format(results: ToolResult[]): string;
}

/**
 * 内容扫描器接口
 */
export interface ContentScanner {
  scanInput(content: string): Promise<ScanResult>;
  scanOutput(content: string): Promise<ScanResult>;
}

export interface ScanResult {
  safe: boolean;
  reason?: string;
  scanner?: string;
}

/**
 * 审计日志接口
 */
export interface AuditLogger {
  write(entry: AuditEntry): Promise<void>;
}

export interface AuditEntry {
  actorType: 'user' | 'agent' | 'system';
  actorId: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId: string;
  detail?: Record<string, unknown>;
  ipAddress?: string;
  result: 'success' | 'failure' | 'blocked';
  errorMessage?: string;
}

/**
 * 推送接口
 */
export interface ResultPusher {
  pushResult(agentId: string, sessionKey: string, content: unknown): void;
  pushChunk(agentId: string, sessionKey: string, chunk: string): void;
  pushDone(agentId: string, sessionKey: string): void;
}

/**
 * Agent 运行时依赖
 */
export interface RuntimeDeps {
  llm: LLMProvider;
  memory: MemoryStore;
  tools: ToolExecutor;
  scanner: ContentScanner;
  audit: AuditLogger;
  pusher: ResultPusher;
}
