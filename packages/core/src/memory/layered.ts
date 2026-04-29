/**
 * 分层记忆系统
 *
 * 三层架构：
 * - 长期记忆 (Long-term): 用户画像、重要事件、永久存储
 * - 中期记忆 (Episodic): 近期对话、任务上下文、自动衰减
 * - 工作记忆 (Working): 当前会话、临时状态
 */

import { query, queryOne } from './db.js'
import { embed } from './embeddings.js'

// ── 类型定义 ──────────────────────────────────────────────

export type MemoryLayer = 'long_term' | 'episodic' | 'working'
export type LongTermType = 'preference' | 'event' | 'relationship' | 'fact'

export interface LongTermMemory {
  id: string
  agentId: string
  type: LongTermType
  content: string
  importance: number // 0-1，用于检索排序
  metadata: Record<string, unknown>
  createdAt: Date
  lastAccessed: Date
  accessCount: number
}

export interface EpisodicMemory {
  id: string
  agentId: string
  content: string
  embedding?: number[]
  decayFactor: number // 每天衰减 0.95
  metadata: Record<string, unknown>
  createdAt: Date
}

export interface WorkingMemory {
  id: string
  agentId: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt: Date
}

export interface MemorySearchResult {
  id: string
  layer: MemoryLayer
  content: string
  relevance: number
  importance?: number
  metadata: Record<string, unknown>
  createdAt: Date
}

// ── 数据库初始化 ──────────────────────────────────────────────

const DECAY_RATE = 0.95 // 每天衰减 5%
const WORKING_MEMORY_LIMIT = 20 // 工作记忆保留条数
const EPISODIC_DECAY_DAYS = 30 // 中期记忆衰减天数

/**
 * 初始化分层记忆表
 */
export async function initLayeredMemoryTables(): Promise<void> {
  // 长期记忆表
  await query(`
    CREATE TABLE IF NOT EXISTS memory_long_term (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance REAL DEFAULT 0.5,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      last_accessed TIMESTAMPTZ DEFAULT NOW(),
      access_count INTEGER DEFAULT 0
    )
  `)

  // 中期记忆表
  await query(`
    CREATE TABLE IF NOT EXISTS memory_episodic (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding vector(1536),
      decay_factor REAL DEFAULT 1.0,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // 工作记忆表
  await query(`
    CREATE TABLE IF NOT EXISTS memory_working (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `)

  // 创建索引
  await query(`CREATE INDEX IF NOT EXISTS idx_long_term_agent ON memory_long_term(agent_id)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_long_term_type ON memory_long_term(type)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_episodic_agent ON memory_episodic(agent_id)`)
  await query(
    `CREATE INDEX IF NOT EXISTS idx_working_session ON memory_working(agent_id, session_id)`,
  )
}

// ── 长期记忆 ──────────────────────────────────────────────

/**
 * 添加长期记忆
 */
export async function addLongTermMemory(
  agentId: string,
  type: LongTermType,
  content: string,
  options: { importance?: number; metadata?: Record<string, unknown> } = {},
): Promise<LongTermMemory> {
  const id = `lt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const importance = options.importance ?? 0.5
  const metadata = options.metadata ?? {}

  await query(
    `INSERT INTO memory_long_term (id, agent_id, type, content, importance, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, agentId, type, content, importance, JSON.stringify(metadata)],
  )

  return {
    id,
    agentId,
    type,
    content,
    importance,
    metadata,
    createdAt: new Date(),
    lastAccessed: new Date(),
    accessCount: 0,
  }
}

/**
 * 搜索长期记忆
 */
export async function searchLongTermMemory(
  agentId: string,
  queryText: string,
  topK = 5,
): Promise<MemorySearchResult[]> {
  // 更新访问时间
  const { embedding } = await embed(queryText)

  if (!embedding?.length) {
    // 文本搜索 fallback
    const rows = await query<LongTermMemory>(
      `SELECT * FROM memory_long_term
       WHERE agent_id = $1 AND content ILIKE $2
       ORDER BY importance DESC, last_accessed DESC
       LIMIT $3`,
      [agentId, `%${queryText}%`, topK],
    )

    return rows.map((r) => ({
      id: r.id,
      layer: 'long_term' as const,
      content: r.content,
      relevance: 1,
      importance: r.importance,
      metadata: r.metadata,
      createdAt: r.createdAt,
    }))
  }

  // 向量搜索
  const rows = await query<{
    id: string
    content: string
    importance: number
    metadata: Record<string, unknown>
    created_at: Date
    similarity: number
  }>(
    `SELECT id, content, importance, metadata, created_at,
            (embedding <=> $2::vector) AS similarity
     FROM memory_long_term
     WHERE agent_id = $1
     ORDER BY importance DESC, embedding <=> $2::vector
     LIMIT $3`,
    [agentId, JSON.stringify(embedding), topK],
  )

  // 更新访问计数
  for (const row of rows) {
    await query(
      `UPDATE memory_long_term
       SET last_accessed = NOW(), access_count = access_count + 1
       WHERE id = $1`,
      [row.id],
    )
  }

  return rows.map((r) => ({
    id: r.id,
    layer: 'long_term' as const,
    content: r.content,
    relevance: 1 - (r.similarity || 0),
    importance: r.importance,
    metadata: r.metadata,
    createdAt: r.created_at,
  }))
}

/**
 * 获取用户画像
 */
export async function getUserProfile(agentId: string): Promise<Record<string, unknown>> {
  const rows = await query<LongTermMemory>(
    `SELECT * FROM memory_long_term
     WHERE agent_id = $1 AND type = 'preference'
     ORDER BY importance DESC`,
    [agentId],
  )

  const profile: Record<string, unknown> = {}
  for (const row of rows) {
    const key = row.metadata['key'] as string
    if (key) {
      profile[key] = row.content
    }
  }
  return profile
}

// ── 中期记忆 ──────────────────────────────────────────────

/**
 * 添加中期记忆
 */
export async function addEpisodicMemory(
  agentId: string,
  content: string,
  metadata: Record<string, unknown> = {},
): Promise<EpisodicMemory> {
  const id = `ep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  // 生成向量
  const { embedding } = await embed(content)

  await query(
    `INSERT INTO memory_episodic (id, agent_id, content, embedding, decay_factor, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      agentId,
      content,
      embedding ? JSON.stringify(embedding) : null,
      1.0,
      JSON.stringify(metadata),
    ],
  )

  return {
    id,
    agentId,
    content,
    embedding: embedding ?? undefined,
    decayFactor: 1.0,
    metadata,
    createdAt: new Date(),
  }
}

/**
 * 搜索中期记忆
 */
export async function searchEpisodicMemory(
  agentId: string,
  queryText: string,
  topK = 5,
): Promise<MemorySearchResult[]> {
  const { embedding } = await embed(queryText)

  if (!embedding?.length) {
    return []
  }

  const rows = await query<{
    id: string
    content: string
    decay_factor: number
    metadata: Record<string, unknown>
    created_at: Date
    similarity: number
  }>(
    `SELECT id, content, decay_factor, metadata, created_at,
            (embedding <=> $2::vector) AS similarity
     FROM memory_episodic
     WHERE agent_id = $1 AND decay_factor > 0.1
     ORDER BY decay_factor DESC, embedding <=> $2::vector
     LIMIT $3`,
    [agentId, JSON.stringify(embedding), topK],
  )

  return rows.map((r) => ({
    id: r.id,
    layer: 'episodic' as const,
    content: r.content,
    relevance: (1 - (r.similarity || 0)) * r.decay_factor,
    metadata: r.metadata,
    createdAt: r.created_at,
  }))
}

/**
 * 应用衰减
 */
export async function applyDecay(agentId: string): Promise<void> {
  await query(
    `UPDATE memory_episodic
     SET decay_factor = decay_factor * $1
     WHERE agent_id = $2`,
    [DECAY_RATE, agentId],
  )

  // 删除衰减过度的记忆
  await query(
    `DELETE FROM memory_episodic
     WHERE agent_id = $1 AND decay_factor < 0.1`,
    [agentId],
  )
}

// ── 工作记忆 ──────────────────────────────────────────────

/**
 * 添加工作记忆
 */
export async function addWorkingMemory(
  agentId: string,
  sessionId: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
): Promise<WorkingMemory> {
  const id = `wk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await query(
    `INSERT INTO memory_working (id, agent_id, session_id, role, content)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, agentId, sessionId, role, content],
  )

  // 清理旧记忆
  await query(
    `DELETE FROM memory_working
     WHERE agent_id = $1 AND session_id = $2
     AND id NOT IN (
       SELECT id FROM memory_working
       WHERE agent_id = $1 AND session_id = $2
       ORDER BY created_at DESC
       LIMIT $3
     )`,
    [agentId, sessionId, WORKING_MEMORY_LIMIT],
  )

  return {
    id,
    agentId,
    sessionId,
    role,
    content,
    createdAt: new Date(),
  }
}

/**
 * 获取工作记忆
 */
export async function getWorkingMemory(
  agentId: string,
  sessionId: string,
): Promise<WorkingMemory[]> {
  return query<WorkingMemory>(
    `SELECT * FROM memory_working
     WHERE agent_id = $1 AND session_id = $2
     ORDER BY created_at ASC`,
    [agentId, sessionId],
  )
}

/**
 * 清空工作记忆
 */
export async function clearWorkingMemory(agentId: string, sessionId: string): Promise<void> {
  await query(`DELETE FROM memory_working WHERE agent_id = $1 AND session_id = $2`, [
    agentId,
    sessionId,
  ])
}

// ── 统一搜索 ──────────────────────────────────────────────

/**
 * 跨层搜索记忆
 */
export async function searchAllMemory(
  agentId: string,
  queryText: string,
  options: { topK?: number; layers?: MemoryLayer[] } = {},
): Promise<MemorySearchResult[]> {
  const { topK = 10, layers = ['long_term', 'episodic', 'working'] } = options
  const results: MemorySearchResult[] = []

  // 长期记忆
  if (layers.includes('long_term')) {
    const lt = await searchLongTermMemory(agentId, queryText, Math.ceil(topK / 2))
    results.push(...lt)
  }

  // 中期记忆
  if (layers.includes('episodic')) {
    const ep = await searchEpisodicMemory(agentId, queryText, Math.ceil(topK / 2))
    results.push(...ep)
  }

  // 工作记忆（文本匹配）
  if (layers.includes('working')) {
    const working = await query<{ id: string; content: string; role: string; created_at: Date }>(
      `SELECT id, content, role, created_at FROM memory_working
       WHERE agent_id = $1 AND content ILIKE $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [agentId, `%${queryText}%`, Math.ceil(topK / 4)],
    )

    results.push(
      ...working.map((w) => ({
        id: w.id,
        layer: 'working' as const,
        content: w.content,
        relevance: 0.8,
        metadata: { role: w.role },
        createdAt: w.created_at,
      })),
    )
  }

  // 按相关性排序
  results.sort((a, b) => b.relevance - a.relevance)
  return results.slice(0, topK)
}

/**
 * 获取上下文注入
 */
export async function getMemoryContext(
  agentId: string,
  sessionId: string,
  queryText?: string,
): Promise<string> {
  const parts: string[] = []

  // 用户画像
  const profile = await getUserProfile(agentId)
  if (Object.keys(profile).length > 0) {
    parts.push('## 用户偏好')
    for (const [key, value] of Object.entries(profile)) {
      parts.push(`- ${key}: ${value}`)
    }
  }

  // 工作记忆
  const working = await getWorkingMemory(agentId, sessionId)
  if (working.length > 0) {
    parts.push('\n## 当前会话')
    for (const m of working.slice(-10)) {
      parts.push(`${m.role}: ${m.content.slice(0, 200)}`)
    }
  }

  // 相关记忆
  if (queryText) {
    const relevant = await searchAllMemory(agentId, queryText, {
      topK: 3,
      layers: ['long_term', 'episodic'],
    })
    if (relevant.length > 0) {
      parts.push('\n## 相关记忆')
      for (const r of relevant) {
        parts.push(`- ${r.content.slice(0, 150)}`)
      }
    }
  }

  return parts.join('\n')
}
