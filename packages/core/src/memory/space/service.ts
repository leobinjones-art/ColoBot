/**
 * 语义空间记忆 - 对外服务接口
 */

import type { SpaceMemoryConfig, SpaceQuery, SpaceRecallResult, MemoryNode, IngestOptions } from '@colomind/types'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync } from 'fs'
import { dirname, resolve } from 'path'
import { SpaceStore } from './store.js'
import { SpaceEngine } from './engine.js'
import { embed, configureEmbedding } from '../embeddings.js'

const DEFAULT_DB_PATH = './data/space-memory.db'

export class SpaceMemoryService {
  private engine: SpaceEngine
  private store: SpaceStore
  private db: Database.Database

  constructor(
    config: Partial<SpaceMemoryConfig> = {},
    dbPath?: string,
    embedFn?: (text: string) => Promise<number[]>,
    summarizeFn?: (texts: string[], prompt?: string) => Promise<string>,
    nameFn?: (texts: string[]) => Promise<string>,
  ) {
    const path = dbPath || DEFAULT_DB_PATH
    const isMemory = path === ':memory:'

    if (!isMemory) {
      const dir = dirname(path)
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    }

    this.db = new Database(path)
    this.db.pragma('journal_mode = WAL')

    this.store = new SpaceStore(this.db)

    const defaultEmbed = embedFn ?? (async (text: string) => {
      console.warn('[SpaceMemory] No embedFn configured, returning empty embedding')
      return []
    })

    const defaultSummarize = summarizeFn ?? (async (texts: string[], _prompt?: string) => {
      return texts.join('\n---\n').slice(0, 500)
    })

    const defaultName = nameFn ?? (async (texts: string[]) => {
      const first = texts[0]?.slice(0, 50) ?? '未命名'
      return `区域-${first}`
    })

    this.engine = new SpaceEngine(this.store, config, defaultEmbed, defaultSummarize, defaultName)
  }

  // ── 写入 ──────────────────────────────────────────

  async ingest(content: string, options?: IngestOptions): Promise<MemoryNode> {
    return this.engine.ingest(content, options ?? {})
  }

  async batchIngest(contents: string[], options?: IngestOptions): Promise<MemoryNode[]> {
    return this.engine.batchIngest(contents, options ?? {})
  }

  // ── 检索 ──────────────────────────────────────────

  async recall(query: SpaceQuery): Promise<SpaceRecallResult> {
    return this.engine.recall(query)
  }

  async drillDown(roomId: string, query?: string, maxResults?: number) {
    return this.engine.drillDown(roomId, query, maxResults)
  }

  // ── 管理 ──────────────────────────────────────────

  async forceSeal(roomId: string): Promise<void> {
    return this.engine.sealRoom(roomId)
  }

  getStats() {
    return this.engine.getStats()
  }

  getConfig(): SpaceMemoryConfig {
    return this.engine.getConfig()
  }

  getStore(): SpaceStore {
    return this.store
  }

  close(): void {
    this.db.close()
  }
}

/**
 * 使用全局 embed() 和 LLM 创建 SpaceMemoryService
 */
export function createSpaceMemoryService(
  config: Partial<SpaceMemoryConfig> = {},
  dbPath?: string,
  summarizeFn?: (texts: string[], prompt?: string) => Promise<string>,
  nameFn?: (texts: string[]) => Promise<string>,
): SpaceMemoryService {
  const embedFn = async (text: string): Promise<number[]> => {
    const result = await embed(text)
    return result.embedding ?? []
  }

  const defaultSummarize = summarizeFn ?? (async (texts: string[], _prompt?: string) => {
    return texts.join('\n---\n').slice(0, 500)
  })

  const defaultName = nameFn ?? (async (texts: string[]) => {
    const first = texts[0]?.slice(0, 50) ?? '未命名'
    return `区域-${first}`
  })

  return new SpaceMemoryService(config, dbPath, embedFn, defaultSummarize, defaultName)
}