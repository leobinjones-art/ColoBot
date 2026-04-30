/**
 * 状态同步
 *
 * 父 Agent 写入任务进度，母 Agent 读取用于接管时生成上下文话术
 */

// ═══════════════════════════════════════════════════════════════
// 会话状态定义
// ═══════════════════════════════════════════════════════════════

export interface SessionState {
  sessionId: string
  agentId: string
  lastUserMessage: string
  lastParentResponse: string | null
  currentTask: string
  taskProgress: number  // 0-100
  lastCheckpoint: {
    round: number
    summary: string
  } | null
  status: 'idle' | 'processing' | 'blocked' | 'error'
  updatedAt: number
}

// ═══════════════════════════════════════════════════════════════
// 状态存储（内存模式）
// ═══════════════════════════════════════════════════════════════

export class StateStore {
  private states: Map<string, SessionState> = new Map()
  private ttl: number  // 状态过期时间（毫秒）

  constructor(ttlMs: number = 30 * 60 * 1000) { // 默认 30 分钟
    this.ttl = ttlMs
  }

  /**
   * 更新会话状态
   */
  update(sessionId: string, update: Partial<Omit<SessionState, 'sessionId' | 'updatedAt'>>): SessionState {
    const existing = this.states.get(sessionId)
    const now = Date.now()

    const state: SessionState = {
      sessionId,
      agentId: update.agentId ?? existing?.agentId ?? '',
      lastUserMessage: update.lastUserMessage ?? existing?.lastUserMessage ?? '',
      lastParentResponse: update.lastParentResponse ?? existing?.lastParentResponse ?? null,
      currentTask: update.currentTask ?? existing?.currentTask ?? '',
      taskProgress: update.taskProgress ?? existing?.taskProgress ?? 0,
      lastCheckpoint: update.lastCheckpoint ?? existing?.lastCheckpoint ?? null,
      status: update.status ?? existing?.status ?? 'idle',
      updatedAt: now,
    }

    this.states.set(sessionId, state)
    return state
  }

  /**
   * 获取会话状态
   */
  get(sessionId: string): SessionState | undefined {
    const state = this.states.get(sessionId)
    if (!state) return undefined

    // 检查是否过期
    if (Date.now() - state.updatedAt > this.ttl) {
      this.states.delete(sessionId)
      return undefined
    }

    return state
  }

  /**
   * 删除会话状态
   */
  delete(sessionId: string): boolean {
    return this.states.delete(sessionId)
  }

  /**
   * 获取 Agent 的所有会话
   */
  getByAgent(agentId: string): SessionState[] {
    const result: SessionState[] = []
    for (const state of this.states.values()) {
      if (state.agentId === agentId) {
        result.push(state)
      }
    }
    return result
  }

  /**
   * 清理过期状态
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0
    for (const [sessionId, state] of this.states) {
      if (now - state.updatedAt > this.ttl) {
        this.states.delete(sessionId)
        cleaned++
      }
    }
    return cleaned
  }

  /**
   * 清空所有状态
   */
  clear(): void {
    this.states.clear()
  }
}

// ═══════════════════════════════════════════════════════════════
// 状态更新器（父 Agent 侧）
// ═══════════════════════════════════════════════════════════════

export class StateUpdater {
  private store: StateStore
  private agentId: string

  constructor(store: StateStore, agentId: string) {
    this.store = store
    this.agentId = agentId
  }

  /**
   * 开始处理
   */
  startProcessing(sessionId: string, userMessage: string): void {
    this.store.update(sessionId, {
      agentId: this.agentId,
      lastUserMessage: userMessage,
      status: 'processing',
      taskProgress: 0,
    })
  }

  /**
   * 更新任务进度
   */
  updateProgress(sessionId: string, task: string, progress: number): void {
    this.store.update(sessionId, {
      currentTask: task,
      taskProgress: Math.min(100, Math.max(0, progress)),
    })
  }

  /**
   * 完成处理
   */
  finishProcessing(sessionId: string, response: string): void {
    this.store.update(sessionId, {
      lastParentResponse: response,
      status: 'idle',
      taskProgress: 100,
    })
  }

  /**
   * 处理错误
   */
  handleError(sessionId: string): void {
    this.store.update(sessionId, {
      status: 'error',
    })
  }

  /**
   * 保存检查点
   */
  saveCheckpoint(sessionId: string, round: number, summary: string): void {
    const state = this.store.get(sessionId)
    this.store.update(sessionId, {
      lastCheckpoint: {
        round,
        summary,
      },
      currentTask: state?.currentTask ?? '',
    })
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultStore: StateStore | null = null

export function getStateStore(): StateStore {
  if (!defaultStore) {
    defaultStore = new StateStore()
  }
  return defaultStore
}

export function resetStateStore(): StateStore {
  defaultStore = new StateStore()
  return defaultStore
}
