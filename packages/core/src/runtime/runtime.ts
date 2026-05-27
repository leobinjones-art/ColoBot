/**
 * ColoMind Runtime 实现
 */

import type { LLMMessage, ContentBlock } from '@colomind/types'
import type {
  ColoMindRuntime,
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
} from './interface.js'

export class ColoMindRuntimeImpl implements ColoMindRuntime {
  constructor(private deps: RuntimeDependencies) {}

  // === 状态管理 ===

  async saveState(namespace: string, key: string, state: unknown): Promise<void> {
    await this.deps.stateStore.save(namespace, key, state)
  }

  async loadState(namespace: string, key: string): Promise<unknown | null> {
    return this.deps.stateStore.load(namespace, key)
  }

  async listStates(namespace: string, filter?: StateFilter): Promise<unknown[]> {
    return this.deps.stateStore.list(namespace, filter)
  }

  async deleteState(namespace: string, key: string): Promise<void> {
    await this.deps.stateStore.delete(namespace, key)
  }

  // === LLM ===

  async chat(prompt: string, options?: ChatOptions): Promise<string> {
    const messages: LLMMessage[] = []
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt })
    }
    messages.push({ role: 'user', content: prompt })

    const response = await this.deps.llm.chat(messages, options)
    return typeof response.content === 'string'
      ? response.content
      : this.extractText(response.content)
  }

  async chatWithHistory(messages: LLMMessage[], options?: ChatOptions): Promise<string> {
    const response = await this.deps.llm.chat(messages, options)
    return typeof response.content === 'string'
      ? response.content
      : this.extractText(response.content)
  }

  private extractText(content: ContentBlock[]): string {
    return content.map((b) => (b.type === 'text' ? b.text : `[${b.type}]`)).join('')
  }

  // === Agent ===

  async createAgent(config: AgentConfig): Promise<string> {
    return this.deps.subAgentManager.create(config)
  }

  async runAgent(agentId: string, task: string): Promise<string> {
    return this.deps.subAgentManager.run(agentId, task)
  }

  async destroyAgent(agentId: string): Promise<void> {
    await this.deps.subAgentManager.destroy(agentId)
  }

  async listAgents(): Promise<AgentInfo[]> {
    return this.deps.subAgentManager.list()
  }

  async getAgent(agentId: string): Promise<AgentInfo | null> {
    return this.deps.subAgentManager.get(agentId)
  }

  // === Skill ===

  async registerSkill(skill: Omit<Skill, 'id'>): Promise<string> {
    return this.deps.skillManager.register(skill)
  }

  async listSkills(): Promise<Skill[]> {
    return this.deps.skillManager.list()
  }

  async getSkill(name: string): Promise<Skill | null> {
    return this.deps.skillManager.get(name)
  }

  async executeSkill(name: string, input: unknown): Promise<unknown> {
    return this.deps.skillManager.execute(name, input)
  }

  // === 记忆 ===

  async addMemory(
    agentId: string,
    key: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.deps.memoryStore.add(agentId, key, content, metadata)

    // 同步写入语义空间记忆
    if (this.deps.spaceMemory) {
      try {
        await this.deps.spaceMemory.ingest(content, {
          sourceId: key,
          importance: (metadata?.importance as number) ?? 0.5,
          tags: metadata?.tags as string[] ?? [],
        })
      } catch (err) {
        // 空间记忆写入失败不影响主流程
        console.warn('[Runtime] Space memory ingest failed:', err)
      }
    }
  }

  async searchMemory(agentId: string, query: string, limit?: number): Promise<MemoryResult[]> {
    // 优先使用语义空间记忆检索
    if (this.deps.spaceMemory) {
      try {
        const spaceResult = await this.deps.spaceMemory.recall({ query, maxResults: limit || 10 })
        if (spaceResult.results.length > 0) {
          return spaceResult.results.map(r => ({
            content: r.node.compressedContent ?? r.node.content,
            score: r.score,
            metadata: {
              roomName: spaceResult.roomName,
              roomId: r.node.roomId,
              sourceId: r.node.sourceId,
              tags: r.node.tags,
            },
          }))
        }
      } catch (err) {
        console.warn('[Runtime] Space memory recall failed, falling back to text search:', err)
      }
    }

    return this.deps.memoryStore.search(agentId, query, limit || 10)
  }

  // === 文件 ===

  async writeFile(path: string, content: string): Promise<void> {
    await this.deps.fileSystem.write(path, content)
  }

  async readFile(path: string): Promise<string> {
    return this.deps.fileSystem.read(path)
  }

  async listDir(path: string): Promise<string[]> {
    return this.deps.fileSystem.list(path)
  }

  async deleteFile(path: string): Promise<void> {
    await this.deps.fileSystem.delete(path)
  }

  // === 配置 ===

  async getConfig(key: string): Promise<unknown> {
    return this.deps.configStore.get(key)
  }

  async setConfig(key: string, value: unknown): Promise<void> {
    await this.deps.configStore.set(key, value)
  }

  async deleteConfig(key: string): Promise<void> {
    await this.deps.configStore.delete(key)
  }

  // === 审批 ===

  async createApproval(
    agentId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    return this.deps.approvalStore.create(agentId, toolName, args)
  }

  async getApproval(id: string): Promise<Approval | null> {
    return this.deps.approvalStore.get(id)
  }

  async listApprovals(filter?: ApprovalFilter): Promise<Approval[]> {
    return this.deps.approvalStore.list(filter)
  }

  async approveApproval(id: string): Promise<void> {
    await this.deps.approvalStore.approve(id)
  }

  async rejectApproval(id: string, reason?: string): Promise<void> {
    await this.deps.approvalStore.reject(id, reason)
  }

  // === 审计 ===

  async writeAuditLog(entry: Omit<AuditLog, 'id' | 'createdAt'>): Promise<void> {
    await this.deps.auditStore.write(entry)
  }

  async listAuditLogs(filter?: AuditFilter): Promise<AuditLog[]> {
    return this.deps.auditStore.list(filter)
  }
}
