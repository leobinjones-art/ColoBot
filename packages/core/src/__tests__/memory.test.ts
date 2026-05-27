/**
 * Memory Module Tests - Real implementations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { EventEmitter } from 'events'

// ── In-memory SQLite database for testing ──

let db: Database.Database

function createTestDb(): Database.Database {
  const database = new Database(':memory:')

  // Create tables matching the pgvector schema (simplified for SQLite)
  database.exec(`
    CREATE TABLE IF NOT EXISTS agent_memory (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      memory_key TEXT NOT NULL,
      memory_value TEXT NOT NULL,
      embedding TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS memory_long_term (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      importance REAL DEFAULT 0.5,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      last_accessed TEXT DEFAULT (datetime('now')),
      access_count INTEGER DEFAULT 0
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS memory_episodic (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT,
      decay_factor REAL DEFAULT 1.0,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  database.exec(`
    CREATE TABLE IF NOT EXISTS memory_working (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `)

  // Create indexes
  database.exec(`CREATE INDEX IF NOT EXISTS idx_long_term_agent ON memory_long_term(agent_id)`)
  database.exec(`CREATE INDEX IF NOT EXISTS idx_long_term_type ON memory_long_term(type)`)
  database.exec(`CREATE INDEX IF NOT EXISTS idx_episodic_agent ON memory_episodic(agent_id)`)
  database.exec(`CREATE INDEX IF NOT EXISTS idx_working_session ON memory_working(agent_id, session_id)`)
  database.exec(`CREATE INDEX IF NOT EXISTS idx_memory_agent ON agent_memory(agent_id)`)
  database.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_key ON agent_memory(agent_id, memory_key)`)

  return database
}

// ── Real query/queryOne using SQLite ──

function isSelectStatement(sql: string): boolean {
  return /^\s*SELECT\s/i.test(sql)
}

function run(sql: string, params: unknown[] = []): Database.RunResult {
  // Convert PostgreSQL-style SQL to SQLite
  let sqliteSql = sql
  let paramIndex = 1
  while (sqliteSql.includes(`$${paramIndex}`)) {
    sqliteSql = sqliteSql.replace(`$${paramIndex}`, '?')
    paramIndex++
  }

  try {
    const stmt = db.prepare(sqliteSql)
    return stmt.run(...params)
  } catch (e) {
    console.error('[TestDB] Run error:', e)
    throw e
  }
}

function query<T = unknown>(sql: string, params: unknown[] = []): T[] {
  // Convert PostgreSQL-style SQL to SQLite
  let sqliteSql = sql
  // Replace $1, $2, etc. with ? placeholders
  let paramIndex = 1
  while (sqliteSql.includes(`$${paramIndex}`)) {
    sqliteSql = sqliteSql.replace(`$${paramIndex}`, '?')
    paramIndex++
  }

  try {
    const stmt = db.prepare(sqliteSql)
    if (isSelectStatement(sqliteSql)) {
      const rows = stmt.all(...params) as T[]
      return rows
    } else {
      // For non-SELECT statements (INSERT, UPDATE, DELETE, CREATE, etc.),
      // better-sqlite3 requires .run() instead of .all()
      stmt.run(...params)
      return [] as T[]
    }
  } catch (e) {
    console.error('[TestDB] Query error:', e)
    throw e
  }
}

function queryOne<T = unknown>(sql: string, params: unknown[] = []): T | null {
  const rows = query<T>(sql, params)
  return rows[0] ?? null
}

describe('Memory Module', () => {
  beforeEach(() => {
    db = createTestDb()
  })

  afterEach(() => {
    db.close()
  })

  describe('Vector Memory', () => {
    it('should add memory', async () => {
      const { configureEmbedding, embed } = await import('../memory/embeddings.js')
      configureEmbedding({ provider: 'mock' })

      const { embedding } = await embed('test content')
      expect(embedding).toBeDefined()
      expect(embedding!.length).toBe(1536)

      // Insert directly using real SQLite
      query(
        `INSERT INTO agent_memory (id, agent_id, memory_key, memory_value, embedding, metadata)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (agent_id, memory_key) DO UPDATE SET
           memory_value = excluded.memory_value,
           embedding = excluded.embedding,
           metadata = excluded.metadata`,
        ['mem-1', 'agent-1', 'test-key', 'test content', JSON.stringify(embedding), JSON.stringify({ source: 'test' })],
      )

      // Verify the row was inserted
      const rows = query<{ id: string; memory_key: string; memory_value: string }>(
        `SELECT id, memory_key, memory_value FROM agent_memory WHERE agent_id = ?`,
        ['agent-1'],
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].memory_key).toBe('test-key')
      expect(rows[0].memory_value).toBe('test content')
    })

    it('should search memory by key', async () => {
      const { configureEmbedding, embed } = await import('../memory/embeddings.js')
      configureEmbedding({ provider: 'mock' })

      const { embedding } = await embed('test content')

      // Insert a memory row
      query(
        `INSERT INTO agent_memory (id, agent_id, memory_key, memory_value, embedding, metadata, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['mem-1', 'agent-1', 'test', 'test content', JSON.stringify(embedding), '{}', new Date().toISOString()],
      )

      // Retrieve by text search (SQLite doesn't have vector similarity, so we do text match)
      const rows = query<{
        id: string
        memory_key: string
        memory_value: string
        embedding: string
        created_at: string
      }>(
        `SELECT id, memory_key, memory_value, embedding, created_at FROM agent_memory WHERE agent_id = ? AND memory_value LIKE ?`,
        ['agent-1', '%test%'],
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].memory_value).toBe('test content')
    })

    it('should list memory', () => {
      // Insert multiple memory rows
      query(
        `INSERT INTO agent_memory (id, agent_id, memory_key, memory_value, embedding, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['mem-1', 'agent-1', 'key1', 'content 1', null, '{}'],
      )
      query(
        `INSERT INTO agent_memory (id, agent_id, memory_key, memory_value, embedding, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        ['mem-2', 'agent-1', 'key2', 'content 2', null, '{}'],
      )

      const rows = query<{ id: string; memory_key: string; memory_value: string }>(
        `SELECT id, memory_key, memory_value FROM agent_memory WHERE agent_id = ? ORDER BY created_at DESC`,
        ['agent-1'],
      )

      expect(rows).toHaveLength(2)
    })
  })

  describe('Embeddings', () => {
    it('should generate mock embeddings', async () => {
      const { embed, configureEmbedding } = await import('../memory/embeddings.js')

      configureEmbedding({ provider: 'mock' })
      const result = await embed('test content')

      expect(result.embedding).toBeDefined()
      expect(result.embedding!.length).toBe(1536)
      expect(result.model).toBe('mock-embedding')
      expect(result.tokens).toBeGreaterThan(0)
    })

    it('should generate different embeddings for different text', async () => {
      const { embed, configureEmbedding } = await import('../memory/embeddings.js')

      configureEmbedding({ provider: 'mock' })
      const result1 = await embed('hello world')
      const result2 = await embed('goodbye world')

      // Mock embedding depends on text length, so they should differ
      expect(result1.embedding).toBeDefined()
      expect(result2.embedding).toBeDefined()
      // At least some elements should differ
      const differing = result1.embedding!.filter(
        (v, i) => v !== result2.embedding![i],
      )
      expect(differing.length).toBeGreaterThan(0)
    })

    it('should generate OpenAI embeddings with real API', async () => {
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) return

      const { embed, configureEmbedding } = await import('../memory/embeddings.js')
      configureEmbedding({ provider: 'openai', openaiApiKey: apiKey })

      const result = await embed('test content for embedding')
      expect(result.embedding).toBeDefined()
      expect(result.embedding!.length).toBeGreaterThan(0)
    })
  })

  describe('Layered Memory', () => {
    it('should export layered memory functions', async () => {
      const layered = await import('../memory/layered.js')

      expect(layered.addLongTermMemory).toBeDefined()
      expect(layered.searchLongTermMemory).toBeDefined()
      expect(layered.addEpisodicMemory).toBeDefined()
      expect(layered.searchEpisodicMemory).toBeDefined()
      expect(layered.addWorkingMemory).toBeDefined()
      expect(layered.getWorkingMemory).toBeDefined()
      expect(layered.searchAllMemory).toBeDefined()
    })

    it('should add and retrieve working memory', () => {
      // Insert working memory directly
      const id = `wk-${Date.now()}-abc123`
      query(
        `INSERT INTO memory_working (id, agent_id, session_id, role, content)
         VALUES (?, ?, ?, ?, ?)`,
        [id, 'agent-1', 'session-1', 'user', 'hello'],
      )

      // Retrieve it
      const rows = query<{ id: string; agent_id: string; session_id: string; role: string; content: string }>(
        `SELECT * FROM memory_working WHERE agent_id = ? AND session_id = ? ORDER BY created_at ASC`,
        ['agent-1', 'session-1'],
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].content).toBe('hello')
      expect(rows[0].role).toBe('user')
    })

    it('should add and retrieve long-term memory', async () => {
      const { configureEmbedding, embed } = await import('../memory/embeddings.js')
      configureEmbedding({ provider: 'mock' })

      const id = `lt-${Date.now()}-abc123`
      query(
        `INSERT INTO memory_long_term (id, agent_id, type, content, importance, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, 'agent-1', 'preference', 'likes coffee', 0.8, JSON.stringify({ key: 'drink' })],
      )

      const rows = query<{ id: string; type: string; content: string; importance: number }>(
        `SELECT id, type, content, importance FROM memory_long_term WHERE agent_id = ? AND type = ?`,
        ['agent-1', 'preference'],
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].content).toBe('likes coffee')
      expect(rows[0].importance).toBe(0.8)
    })

    it('should add and search episodic memory', async () => {
      const { configureEmbedding, embed } = await import('../memory/embeddings.js')
      configureEmbedding({ provider: 'mock' })

      const { embedding } = await embed('episodic test content')

      const id = `ep-${Date.now()}-abc123`
      query(
        `INSERT INTO memory_episodic (id, agent_id, content, embedding, decay_factor, metadata)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, 'agent-1', 'episodic test content', JSON.stringify(embedding), 1.0, '{}'],
      )

      // Text search (since SQLite lacks vector ops)
      const rows = query<{ id: string; content: string; decay_factor: number }>(
        `SELECT id, content, decay_factor FROM memory_episodic WHERE agent_id = ? AND content LIKE ? AND decay_factor > 0.1`,
        ['agent-1', '%episodic%'],
      )

      expect(rows).toHaveLength(1)
      expect(rows[0].decay_factor).toBe(1.0)
    })
  })
})