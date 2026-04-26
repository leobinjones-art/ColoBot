/**
 * ColoBot Runtime 实现
 */

import type { LLMMessage, ContentBlock } from '@colobot/types';
import type {
  ColoBotRuntime,
  RuntimeDependencies,
  ChatOptions,
  AgentConfig,
  AgentInfo,
  MemoryResult,
  StateFilter,
  ApprovalFilter,
  Approval,
  AuditFilter,
  AuditLog,
  Skill,
} from './interface.js';

export class ColoBotRuntimeImpl implements ColoBotRuntime {
  constructor(private deps: RuntimeDependencies) {}

  // === 状态管理 ===

  async saveState(namespace: string, key: string, state: unknown): Promise<void> {
    await this.deps.stateStore.save(namespace, key, state);
  }

  async loadState(namespace: string, key: string): Promise<unknown | null> {
    return this.deps.stateStore.load(namespace, key);
  }

  async listStates(namespace: string, filter?: StateFilter): Promise<unknown[]> {
    return this.deps.stateStore.list(namespace, filter);
  }

  async deleteState(namespace: string, key: string): Promise<void> {
    await this.deps.stateStore.delete(namespace, key);
  }

  // === LLM ===

  async chat(prompt: string, options?: ChatOptions): Promise<string> {
    const messages: LLMMessage[] = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.deps.llm.chat(messages, options);
    return typeof response.content === 'string' ? response.content : this.extractText(response.content);
  }

  async chatWithHistory(messages: LLMMessage[], options?: ChatOptions): Promise<string> {
    const response = await this.deps.llm.chat(messages, options);
    return typeof response.content === 'string' ? response.content : this.extractText(response.content);
  }

  private extractText(content: ContentBlock[]): string {
    return content.map(b => b.type === 'text' ? b.text : `[${b.type}]`).join('');
  }

  // === Agent ===

  async createAgent(config: AgentConfig): Promise<string> {
    return this.deps.subAgentManager.create(config);
  }

  async runAgent(agentId: string, task: string): Promise<string> {
    return this.deps.subAgentManager.run(agentId, task);
  }

  async destroyAgent(agentId: string): Promise<void> {
    await this.deps.subAgentManager.destroy(agentId);
  }

  async listAgents(): Promise<AgentInfo[]> {
    return this.deps.subAgentManager.list();
  }

  async getAgent(agentId: string): Promise<AgentInfo | null> {
    return this.deps.subAgentManager.get(agentId);
  }

  // === Skill ===

  async registerSkill(skill: Omit<Skill, 'id'>): Promise<string> {
    return this.deps.skillManager.register(skill);
  }

  async listSkills(): Promise<Skill[]> {
    return this.deps.skillManager.list();
  }

  async getSkill(name: string): Promise<Skill | null> {
    return this.deps.skillManager.get(name);
  }

  async executeSkill(name: string, input: unknown): Promise<unknown> {
    return this.deps.skillManager.execute(name, input);
  }

  // === 记忆 ===

  async addMemory(agentId: string, key: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    await this.deps.memoryStore.add(agentId, key, content, metadata);
  }

  async searchMemory(agentId: string, query: string, limit?: number): Promise<MemoryResult[]> {
    return this.deps.memoryStore.search(agentId, query, limit || 10);
  }

  // === 文件 ===

  async writeFile(path: string, content: string): Promise<void> {
    await this.deps.fileSystem.write(path, content);
  }

  async readFile(path: string): Promise<string> {
    return this.deps.fileSystem.read(path);
  }

  async listDir(path: string): Promise<string[]> {
    return this.deps.fileSystem.list(path);
  }

  async deleteFile(path: string): Promise<void> {
    await this.deps.fileSystem.delete(path);
  }

  // === 配置 ===

  async getConfig(key: string): Promise<unknown> {
    return this.deps.configStore.get(key);
  }

  async setConfig(key: string, value: unknown): Promise<void> {
    await this.deps.configStore.set(key, value);
  }

  async deleteConfig(key: string): Promise<void> {
    await this.deps.configStore.delete(key);
  }

  // === 审批 ===

  async createApproval(agentId: string, toolName: string, args: Record<string, unknown>): Promise<string> {
    return this.deps.approvalStore.create(agentId, toolName, args);
  }

  async getApproval(id: string): Promise<Approval | null> {
    return this.deps.approvalStore.get(id);
  }

  async listApprovals(filter?: ApprovalFilter): Promise<Approval[]> {
    return this.deps.approvalStore.list(filter);
  }

  async approveApproval(id: string): Promise<void> {
    await this.deps.approvalStore.approve(id);
  }

  async rejectApproval(id: string, reason?: string): Promise<void> {
    await this.deps.approvalStore.reject(id, reason);
  }

  // === 审计 ===

  async writeAuditLog(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    await this.deps.auditStore.write(entry);
  }

  async listAuditLogs(filter?: AuditFilter): Promise<AuditLog[]> {
    return this.deps.auditStore.list(filter);
  }
}