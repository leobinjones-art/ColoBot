/**
 * ColoBot Runtime 接口定义
 *
 * 所有插件通过此接口使用 core 能力，不直接访问底层实现
 */

import type { LLMMessage, ContentBlock, ToolCall } from '@colobot/types';

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
}

export interface AgentConfig {
  name: string;
  soul?: string;
  tools?: string[];
  ttlMs?: number;
}

export interface AgentInfo {
  id: string;
  name: string;
  status: 'active' | 'idle' | 'expired';
  createdAt: Date;
}

export interface Skill {
  id: string;
  name: string;
  trigger?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface MemoryResult {
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
}

export interface StateFilter {
  status?: string;
  limit?: number;
  offset?: number;
}

export interface ApprovalFilter {
  status?: 'pending' | 'approved' | 'rejected';
  agentId?: string;
  limit?: number;
}

export interface Approval {
  id: string;
  agentId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
}

export interface AuditFilter {
  actorId?: string;
  action?: string;
  startTime?: Date;
  endTime?: Date;
  limit?: number;
}

export interface AuditLog {
  id: string;
  actorType: 'user' | 'agent' | 'system';
  actorId: string;
  action: string;
  targetType: string;
  targetId: string;
  result: 'success' | 'failure' | 'blocked';
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════
// 核心接口
// ═══════════════════════════════════════════════════════════════

export interface ColoBotRuntime {
  // === 状态管理 ===
  saveState(namespace: string, key: string, state: unknown): Promise<void>;
  loadState(namespace: string, key: string): Promise<unknown | null>;
  listStates(namespace: string, filter?: StateFilter): Promise<unknown[]>;
  deleteState(namespace: string, key: string): Promise<void>;

  // === LLM ===
  chat(prompt: string, options?: ChatOptions): Promise<string>;
  chatWithHistory(messages: LLMMessage[], options?: ChatOptions): Promise<string>;

  // === Agent ===
  createAgent(config: AgentConfig): Promise<string>;
  runAgent(agentId: string, task: string): Promise<string>;
  destroyAgent(agentId: string): Promise<void>;
  listAgents(): Promise<AgentInfo[]>;
  getAgent(agentId: string): Promise<AgentInfo | null>;

  // === Skill ===
  registerSkill(skill: Omit<Skill, 'id'>): Promise<string>;
  listSkills(): Promise<Skill[]>;
  getSkill(name: string): Promise<Skill | null>;
  executeSkill(name: string, input: unknown): Promise<unknown>;

  // === 记忆 ===
  addMemory(agentId: string, key: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
  searchMemory(agentId: string, query: string, limit?: number): Promise<MemoryResult[]>;

  // === 文件 ===
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  listDir(path: string): Promise<string[]>;
  deleteFile(path: string): Promise<void>;

  // === 配置 ===
  getConfig(key: string): Promise<unknown>;
  setConfig(key: string, value: unknown): Promise<void>;
  deleteConfig(key: string): Promise<void>;

  // === 审批 ===
  createApproval(agentId: string, toolName: string, args: Record<string, unknown>): Promise<string>;
  getApproval(id: string): Promise<Approval | null>;
  listApprovals(filter?: ApprovalFilter): Promise<Approval[]>;
  approveApproval(id: string): Promise<void>;
  rejectApproval(id: string, reason?: string): Promise<void>;

  // === 审计 ===
  writeAuditLog(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void>;
  listAuditLogs(filter?: AuditFilter): Promise<AuditLog[]>;
}

// ═══════════════════════════════════════════════════════════════
// Runtime 依赖
// ═══════════════════════════════════════════════════════════════

export interface RuntimeDependencies {
  // LLM Provider
  llm: {
    chat(messages: LLMMessage[], options?: ChatOptions): Promise<{ content: string | ContentBlock[] }>;
  };

  // 状态存储
  stateStore: {
    save(namespace: string, key: string, state: unknown): Promise<void>;
    load(namespace: string, key: string): Promise<unknown | null>;
    list(namespace: string, filter?: StateFilter): Promise<unknown[]>;
    delete(namespace: string, key: string): Promise<void>;
  };

  // 记忆存储
  memoryStore: {
    add(agentId: string, key: string, content: string, metadata?: Record<string, unknown>): Promise<void>;
    search(agentId: string, query: string, limit?: number): Promise<MemoryResult[]>;
  };

  // 文件系统
  fileSystem: {
    write(path: string, content: string): Promise<void>;
    read(path: string): Promise<string>;
    list(path: string): Promise<string[]>;
    delete(path: string): Promise<void>;
  };

  // 配置存储
  configStore: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<void>;
    delete(key: string): Promise<void>;
  };

  // 审批存储
  approvalStore: {
    create(agentId: string, toolName: string, args: Record<string, unknown>): Promise<string>;
    get(id: string): Promise<Approval | null>;
    list(filter?: ApprovalFilter): Promise<Approval[]>;
    approve(id: string): Promise<void>;
    reject(id: string, reason?: string): Promise<void>;
  };

  // 审计存储
  auditStore: {
    write(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void>;
    list(filter?: AuditFilter): Promise<AuditLog[]>;
  };

  // 子 Agent 管理
  subAgentManager: {
    create(config: AgentConfig): Promise<string>;
    run(agentId: string, task: string): Promise<string>;
    destroy(agentId: string): Promise<void>;
    list(): Promise<AgentInfo[]>;
    get(agentId: string): Promise<AgentInfo | null>;
  };

  // Skill 管理
  skillManager: {
    register(skill: Omit<Skill, 'id'>): Promise<string>;
    list(): Promise<Skill[]>;
    get(name: string): Promise<Skill | null>;
    execute(name: string, input: unknown): Promise<unknown>;
  };
}
