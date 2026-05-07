/**
 * Redis 共享状态
 *
 * 多进程模式下的状态共享
 * 支持 SessionState 和 AgentHealthStatus
 */

import type { SessionState } from './state.js'
import type { AgentHealthStatus } from './heartbeat.js'

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface RedisConfig {
  host: string
  port: number
  password?: string
  db?: number
  keyPrefix?: string
  ttl?: number // 默认 TTL（秒）
}

const DEFAULT_CONFIG: RedisConfig = {
  host: 'localhost',
  port: 6379,
  keyPrefix: 'nexusmind:',
  ttl: 3600, // 1 小时
}

// ═══════════════════════════════════════════════════════════════
// Redis 客户端接口
// ═══════════════════════════════════════════════════════════════

/**
 * Redis 客户端接口
 *
 * 兼容 ioredis 和 node-redis
 */
export interface IRedisClient {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttl?: number): Promise<void>
  del(key: string): Promise<void>
  keys(pattern: string): Promise<string[]>
  expire(key: string, ttl: number): Promise<void>
  ttl(key: string): Promise<number>
  publish(channel: string, message: string): Promise<void>
  subscribe(channel: string, callback: (message: string) => void): Promise<void>
  unsubscribe(channel: string): Promise<void>
  quit(): Promise<void>
}

// ═══════════════════════════════════════════════════════════════
// Mock Redis 客户端（单机模式）
// ═══════════════════════════════════════════════════════════════

/**
 * Mock Redis 客户端
 *
 * 使用内存存储，用于单机模式或测试
 */
export class MockRedisClient implements IRedisClient {
  private store: Map<string, { value: string; expiresAt?: number }> = new Map()
  private subscribers: Map<string, Set<(msg: string) => void>> = new Map()

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return null
    }

    return entry.value
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expiresAt = ttl ? Date.now() + ttl * 1000 : undefined
    this.store.set(key, { value, expiresAt })
  }

  async del(key: string): Promise<void> {
    this.store.delete(key)
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return Array.from(this.store.keys()).filter((k) => regex.test(k))
  }

  async expire(key: string, ttl: number): Promise<void> {
    const entry = this.store.get(key)
    if (entry) {
      entry.expiresAt = Date.now() + ttl * 1000
    }
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key)
    if (!entry || !entry.expiresAt) return -1
    const remaining = Math.floor((entry.expiresAt - Date.now()) / 1000)
    return remaining > 0 ? remaining : -2
  }

  async publish(channel: string, message: string): Promise<void> {
    const callbacks = this.subscribers.get(channel)
    if (callbacks) {
      callbacks.forEach((cb) => cb(message))
    }
  }

  async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set())
    }
    this.subscribers.get(channel)!.add(callback)
  }

  async unsubscribe(channel: string): Promise<void> {
    this.subscribers.delete(channel)
  }

  async quit(): Promise<void> {
    this.store.clear()
    this.subscribers.clear()
  }
}

// ═══════════════════════════════════════════════════════════════
// Redis 状态存储
// ═══════════════════════════════════════════════════════════════

/**
 * Redis 状态存储
 *
 * 支持 SessionState 和 AgentHealthStatus 的持久化
 */
export class RedisStateStore {
  private client: IRedisClient
  private keyPrefix: string
  private ttl: number

  constructor(client: IRedisClient, config?: Partial<RedisConfig>) {
    this.client = client
    this.keyPrefix = config?.keyPrefix ?? 'nexusmind:'
    this.ttl = config?.ttl ?? 3600
  }

  // ─── Session State ───────────────────────────────────────────

  /**
   * 保存会话状态
   */
  async saveSessionState(state: SessionState): Promise<void> {
    const key = `${this.keyPrefix}session:${state.sessionId}`
    await this.client.set(key, JSON.stringify(state), this.ttl)
  }

  /**
   * 获取会话状态
   */
  async getSessionState(sessionId: string): Promise<SessionState | null> {
    const key = `${this.keyPrefix}session:${sessionId}`
    const data = await this.client.get(key)
    return data ? JSON.parse(data) : null
  }

  /**
   * 删除会话状态
   */
  async deleteSessionState(sessionId: string): Promise<void> {
    const key = `${this.keyPrefix}session:${sessionId}`
    await this.client.del(key)
  }

  /**
   * 获取 Agent 的所有会话
   */
  async getSessionsByAgent(agentId: string): Promise<SessionState[]> {
    const pattern = `${this.keyPrefix}session:*`
    const keys = await this.client.keys(pattern)
    const sessions: SessionState[] = []

    for (const key of keys) {
      const data = await this.client.get(key)
      if (data) {
        const state = JSON.parse(data) as SessionState
        if (state.agentId === agentId) {
          sessions.push(state)
        }
      }
    }

    return sessions
  }

  // ─── Agent Health ────────────────────────────────────────────

  /**
   * 保存 Agent 健康状态
   */
  async saveAgentHealth(status: AgentHealthStatus): Promise<void> {
    const key = `${this.keyPrefix}agent:${status.agentId}:health`
    await this.client.set(key, JSON.stringify(status), this.ttl)
  }

  /**
   * 获取 Agent 健康状态
   */
  async getAgentHealth(agentId: string): Promise<AgentHealthStatus | null> {
    const key = `${this.keyPrefix}agent:${agentId}:health`
    const data = await this.client.get(key)
    return data ? JSON.parse(data) : null
  }

  /**
   * 获取所有 Agent 健康状态
   */
  async getAllAgentHealth(): Promise<AgentHealthStatus[]> {
    const pattern = `${this.keyPrefix}agent:*:health`
    const keys = await this.client.keys(pattern)
    const statuses: AgentHealthStatus[] = []

    for (const key of keys) {
      const data = await this.client.get(key)
      if (data) {
        statuses.push(JSON.parse(data))
      }
    }

    return statuses
  }

  /**
   * 删除 Agent 健康状态
   */
  async deleteAgentHealth(agentId: string): Promise<void> {
    const key = `${this.keyPrefix}agent:${agentId}:health`
    await this.client.del(key)
  }

  // ─── 通用 ────────────────────────────────────────────────────

  /**
   * 清理所有数据
   */
  async clear(): Promise<void> {
    const pattern = `${this.keyPrefix}*`
    const keys = await this.client.keys(pattern)
    for (const key of keys) {
      await this.client.del(key)
    }
  }

  /**
   * 获取客户端
   */
  getClient(): IRedisClient {
    return this.client
  }
}

// ═══════════════════════════════════════════════════════════════
// 工厂函数
// ═══════════════════════════════════════════════════════════════

/**
 * 创建 Redis 客户端
 *
 * 动态导入 ioredis，失败时返回 Mock 客户端
 */
export async function createRedisClient(config?: Partial<RedisConfig>): Promise<IRedisClient> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }

  try {
    // 尝试动态导入 ioredis
    // @ts-ignore - ioredis 是可选依赖
    const Redis = await import('ioredis').then((m) => m.default || m).catch(() => null)

    if (Redis) {
      // @ts-ignore
      const client = new Redis({
        host: fullConfig.host,
        port: fullConfig.port,
        password: fullConfig.password,
        db: fullConfig.db,
      })

      // 包装为统一接口
      return {
        get: async (key: string) => client.get(key),
        set: async (key: string, value: string, ttl?: number) => {
          if (ttl) {
            await client.setex(key, ttl, value)
          } else {
            await client.set(key, value)
          }
        },
        del: async (key: string) => {
          await client.del(key)
        },
        keys: async (pattern: string) => client.keys(pattern),
        expire: async (key: string, ttl: number) => {
          await client.expire(key, ttl)
        },
        ttl: async (key: string) => client.ttl(key),
        publish: async (channel: string, message: string) => {
          await client.publish(channel, message)
        },
        subscribe: async (channel: string, callback: (msg: string) => void) => {
          client.subscribe(channel)
          client.on('message', (ch: string, msg: string) => {
            if (ch === channel) callback(msg)
          })
        },
        unsubscribe: async (channel: string) => {
          await client.unsubscribe(channel)
        },
        quit: async () => {
          await client.quit()
        },
      }
    }
  } catch (error) {
    console.warn('[Redis] Failed to connect, using mock client:', error)
  }

  // 降级到 Mock 客户端
  return new MockRedisClient()
}
