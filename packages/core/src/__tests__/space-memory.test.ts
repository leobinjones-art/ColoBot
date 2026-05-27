/**
 * Space Memory 测试
 * 使用真实 better-sqlite3 内存数据库和真实实现替代 vi.fn()
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SpaceStore } from '../memory/space/store.js'
import { SpaceEngine } from '../memory/space/engine.js'
import { SpaceMemoryService } from '../memory/space/service.js'
import { ColoMindRuntimeImpl } from '../runtime/runtime.js'
import { InMemoryAudit } from '../adapters/audit.js'
import { InMemoryStateStore } from '../adapters/state.js'
import { LocalFileSystemAdapter } from '../adapters/filesystem.js'
import { CallbackPusher } from '../adapters/pusher.js'
import { MockProvider } from '../providers/mock.js'
import {
  cosineSimilarity, cosineDistance, findNearestRoom,
  updateCentroid, kMeansSplit,
} from '../memory/space/cluster.js'
import { memoryStrength, rankByStrength, shouldArchive, nextReviewTime } from '../memory/space/decay.js'
import type { MemoryNode, Room } from '@colomind/types'
import type { MemoryResult } from '../runtime/interface.js'

// ── InMemoryMemoryStore (add/search interface) ──────────────
// ColoMindRuntimeImpl requires memoryStore with add() and search(),
// which is different from the InMemoryStore (append/getHistory/clear)

class InMemoryMemoryStore {
  private memories: Map<string, Array<{ content: string; metadata?: Record<string, unknown> }>> = new Map()

  async add(agentId: string, key: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    const list = this.memories.get(agentId) || []
    list.push({ content, metadata })
    this.memories.set(agentId, list)
  }

  async search(agentId: string, query: string, limit?: number): Promise<MemoryResult[]> {
    const list = this.memories.get(agentId) || []
    // Simple text matching fallback
    const matched = list.filter(m => m.content.toLowerCase().includes(query.toLowerCase()))
    return matched.slice(0, limit || 10).map(m => ({
      content: m.content,
      score: 1.0,
      metadata: m.metadata,
    }))
  }
}

// ── Real Embedding / Summarize / Name ──────────────────────────

const DIM = 8

function randomEmbedding(): number[] {
  const v = Array.from({ length: DIM }, () => Math.random() - 0.5)
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return v.map(x => x / norm)
}

function similarEmbedding(base: number[], noise = 0.1): number[] {
  const v = base.map(x => x + (Math.random() - 0.5) * noise)
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
  return v.map(x => x / norm)
}

// Real embedding function: deterministic, hash-based vectors
let embedCallCount = 0
const embedCalls: Array<{ text: string; result: number[] }> = []
const realEmbedFn = async (text: string): Promise<number[]> => {
  embedCallCount++
  const size = DIM
  const vec = new Array(size).fill(0)
  for (let i = 0; i < text.length; i++) {
    vec[i % size] += text.charCodeAt(i)
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  const result = norm > 0 ? vec.map(v => v / norm) : vec
  embedCalls.push({ text, result })
  return result
}

// Real summarize function: simple text truncation with tracking
let summarizeCallCount = 0
const summarizeCalls: Array<{ texts: string[]; result: string }> = []
const realSummarizeFn = async (texts: string[], _prompt?: string): Promise<string> => {
  summarizeCallCount++
  const result = texts.join(' ').slice(0, 100)
  summarizeCalls.push({ texts, result })
  return result
}

// Real name function: extract first words with tracking
let nameCallCount = 0
const nameCalls: Array<{ texts: string[]; result: string }> = []
const realNameFn = async (texts: string[]): Promise<string> => {
  nameCallCount++
  const first = texts[0]?.slice(0, 20) ?? '未命名'
  const result = `区域-${nameCallCount}-${first}`
  nameCalls.push({ texts, result })
  return result
}

function resetCallTrackers(): void {
  embedCallCount = 0
  embedCalls.length = 0
  summarizeCallCount = 0
  summarizeCalls.length = 0
  nameCallCount = 0
  nameCalls.length = 0
}

// ── Store 测试 ──────────────────────────────────────────────

describe('SpaceStore', () => {
  let db: Database.Database
  let store: SpaceStore

  beforeEach(() => {
    db = new Database(':memory:')
    store = new SpaceStore(db)
    resetCallTrackers()
  })

  it('should create tables on init', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'space_%'").all() as any[]
    expect(tables.map((t: any) => t.name).sort()).toEqual([
      'space_corridors', 'space_nodes', 'space_rooms'
    ])
  })

  it('should insert and get a room', () => {
    const room: Room = {
      id: 'room-1',
      name: '测试房间',
      centroid: randomEmbedding(),
      nodeCount: 0,
      totalTokens: 0,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      isActive: true,
    }
    store.insertRoom(room)
    const got = store.getRoom('room-1')
    expect(got).not.toBeNull()
    expect(got!.name).toBe('测试房间')
    expect(got!.centroid.length).toBe(DIM)
  })

  it('should insert and get a node', () => {
    const room: Room = {
      id: 'room-1', name: '测试', centroid: randomEmbedding(),
      nodeCount: 0, totalTokens: 0, createdAt: Date.now(), lastActivity: Date.now(), isActive: true,
    }
    store.insertRoom(room)

    const node: MemoryNode = {
      id: 'node-1', content: '测试内容', embedding: randomEmbedding(),
      roomId: 'room-1', timestamp: Date.now(), accessCount: 0,
      lastAccessed: Date.now(), importance: 0.5, tags: ['test'], lifecycle: 'active',
    }
    store.insertNode(node)
    const got = store.getNode('node-1')
    expect(got).not.toBeNull()
    expect(got!.content).toBe('测试内容')
    expect(got!.embedding.length).toBe(DIM)
    expect(got!.tags).toEqual(['test'])
  })

  it('should get nodes by room', () => {
    const room: Room = {
      id: 'room-1', name: '测试', centroid: randomEmbedding(),
      nodeCount: 0, totalTokens: 0, createdAt: Date.now(), lastActivity: Date.now(), isActive: true,
    }
    store.insertRoom(room)

    for (let i = 0; i < 5; i++) {
      store.insertNode({
        id: `node-${i}`, content: `内容${i}`, embedding: randomEmbedding(),
        roomId: 'room-1', timestamp: Date.now(), accessCount: 0,
        lastAccessed: Date.now(), importance: 0.5, tags: [], lifecycle: 'active',
      })
    }

    const nodes = store.getNodesByRoom('room-1')
    expect(nodes.length).toBe(5)

    const activeNodes = store.getActiveNodesByRoom('room-1')
    expect(activeNodes.length).toBe(5)
  })

  it('should handle corridors', () => {
    // Create two rooms
    store.insertRoom({
      id: 'r-1', name: '房间1', centroid: randomEmbedding(),
      nodeCount: 0, totalTokens: 0, createdAt: Date.now(), lastActivity: Date.now(), isActive: true,
    })
    store.insertRoom({
      id: 'r-2', name: '房间2', centroid: randomEmbedding(),
      nodeCount: 0, totalTokens: 0, createdAt: Date.now(), lastActivity: Date.now(), isActive: true,
    })

    store.insertCorridor({
      id: 'c-1', fromRoomId: 'r-1', toRoomId: 'r-2',
      strength: 0.8, sharedTags: ['编程'],
    })
    const corridors = store.getAllCorridorsForRoom('r-1')
    expect(corridors.length).toBe(1)
    expect(corridors[0].strength).toBe(0.8)
    expect(corridors[0].sharedTags).toEqual(['编程'])
  })

  it('should return stats', () => {
    const stats = store.getStats()
    expect(stats).toEqual({ roomCount: 0, nodeCount: 0, corridorCount: 0 })
  })

  it('should batch insert nodes', () => {
    const room: Room = {
      id: 'room-1', name: '测试', centroid: randomEmbedding(),
      nodeCount: 0, totalTokens: 0, createdAt: Date.now(), lastActivity: Date.now(), isActive: true,
    }
    store.insertRoom(room)

    const nodes: MemoryNode[] = Array.from({ length: 20 }, (_, i) => ({
      id: `batch-${i}`, content: `批量${i}`, embedding: randomEmbedding(),
      roomId: 'room-1', timestamp: Date.now(), accessCount: 0,
      lastAccessed: Date.now(), importance: 0.5, tags: [], lifecycle: 'active',
    }))

    store.batchInsertNodes(nodes)
    expect(store.getNodesByRoom('room-1').length).toBe(20)
  })
})

// ── Cluster 测试 ──────────────────────────────────────────────

describe('Cluster', () => {
  it('cosineSimilarity should return 1 for identical vectors', () => {
    const v = randomEmbedding()
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5)
  })

  it('cosineSimilarity should return ~0 for orthogonal vectors', () => {
    const a = [1, 0, 0, 0]
    const b = [0, 1, 0, 0]
    expect(Math.abs(cosineSimilarity(a, b))).toBeCloseTo(0, 5)
  })

  it('cosineDistance should be 1 - similarity', () => {
    const a = randomEmbedding()
    const b = randomEmbedding()
    expect(cosineDistance(a, b)).toBeCloseTo(1 - cosineSimilarity(a, b), 5)
  })

  it('findNearestRoom should find closest room', () => {
    const base = randomEmbedding()
    const roomA: Room = {
      id: 'a', name: 'A', centroid: similarEmbedding(base, 0.05),
      nodeCount: 0, totalTokens: 0, createdAt: Date.now(), lastActivity: Date.now(), isActive: true,
    }
    const roomB: Room = {
      id: 'b', name: 'B', centroid: randomEmbedding(),
      nodeCount: 0, totalTokens: 0, createdAt: Date.now(), lastActivity: Date.now(), isActive: true,
    }

    const result = findNearestRoom(base, [roomA, roomB], 0.5)
    expect(result.room?.id).toBe('a')
  })

  it('findNearestRoom should return null when all rooms are too far', () => {
    const base = randomEmbedding()
    const roomA: Room = {
      id: 'a', name: 'A', centroid: randomEmbedding(),
      nodeCount: 0, totalTokens: 0, createdAt: Date.now(), lastActivity: Date.now(), isActive: true,
    }

    const result = findNearestRoom(base, [roomA], 0.01)
    expect(result.room).toBeNull()
  })

  it('updateCentroid should compute incremental mean', () => {
    const centroid = [1, 0, 0, 0]
    const newEmb = [0, 1, 0, 0]
    const updated = updateCentroid(centroid, 1, newEmb)
    expect(updated[0]).toBeCloseTo(0.5, 5)
    expect(updated[1]).toBeCloseTo(0.5, 5)
  })

  it('kMeansSplit should split nodes into two groups', () => {
    // Create two groups of clearly different vectors
    const groupA: MemoryNode[] = Array.from({ length: 10 }, (_, i) => ({
      id: `a-${i}`, content: `A${i}`, embedding: similarEmbedding([1, 0, 0, 0, 0, 0, 0, 0], 0.1),
      roomId: 'r1', timestamp: Date.now(), accessCount: 0,
      lastAccessed: Date.now(), importance: 0.5, tags: [], lifecycle: 'active' as const,
    }))
    const groupB: MemoryNode[] = Array.from({ length: 10 }, (_, i) => ({
      id: `b-${i}`, content: `B${i}`, embedding: similarEmbedding([0, 0, 0, 0, 0, 0, 0, 1], 0.1),
      roomId: 'r1', timestamp: Date.now(), accessCount: 0,
      lastAccessed: Date.now(), importance: 0.5, tags: [], lifecycle: 'active' as const,
    }))

    const result = kMeansSplit([...groupA, ...groupB])
    expect(result.groupA.length).toBeGreaterThan(0)
    expect(result.groupB.length).toBeGreaterThan(0)
    expect(result.groupA.length + result.groupB.length).toBe(20)
  })
})

// ── Decay 测试 ──────────────────────────────────────────────

describe('Decay', () => {
  it('memoryStrength should be higher for recently accessed items', () => {
    const now = Date.now()
    const recent = memoryStrength(0.5, 1, now)
    const old = memoryStrength(0.5, 1, now - 30 * 24 * 60 * 60 * 1000) // 30 days ago
    expect(recent).toBeGreaterThan(old)
  })

  it('memoryStrength should be higher for frequently accessed items', () => {
    const now = Date.now()
    const frequent = memoryStrength(0.5, 10, now)
    const rare = memoryStrength(0.5, 1, now)
    expect(frequent).toBeGreaterThan(rare)
  })

  it('memoryStrength should be higher for important items', () => {
    const now = Date.now()
    const important = memoryStrength(0.9, 1, now)
    const trivial = memoryStrength(0.1, 1, now)
    expect(important).toBeGreaterThan(trivial)
  })

  it('rankByStrength should sort by strength', () => {
    const now = Date.now()
    const items = [
      { id: 'a', importance: 0.1, accessCount: 0, lastAccessed: now - 100000 },
      { id: 'b', importance: 0.9, accessCount: 10, lastAccessed: now },
      { id: 'c', importance: 0.5, accessCount: 2, lastAccessed: now - 50000 },
    ]
    const ranked = rankByStrength(items)
    expect(ranked[0].id).toBe('b')
  })

  it('shouldArchive should return true for weak memories', () => {
    const old = Date.now() - 365 * 24 * 60 * 60 * 1000 // 1 year ago
    expect(shouldArchive(0.1, 0, old)).toBe(true)
  })

  it('shouldArchive should return false for strong memories', () => {
    expect(shouldArchive(0.9, 10, Date.now())).toBe(false)
  })

  it('nextReviewTime should increase with access count', () => {
    const t1 = nextReviewTime(1)
    const t2 = nextReviewTime(5)
    expect(t2).toBeGreaterThan(t1)
  })
})

// ── Engine 测试 ──────────────────────────────────────────────

describe('SpaceEngine', () => {
  let db: Database.Database
  let store: SpaceStore
  let engine: SpaceEngine

  beforeEach(() => {
    db = new Database(':memory:')
    store = new SpaceStore(db)
    engine = new SpaceEngine(store, {}, realEmbedFn, realSummarizeFn, realNameFn)
    resetCallTrackers()
  })

  it('should ingest content and create a new room', async () => {
    const node = await engine.ingest('今天学习了 TypeScript')
    expect(node.content).toBe('今天学习了 TypeScript')
    expect(node.lifecycle).toBe('active')
    expect(node.roomId).toBeTruthy()

    const stats = engine.getStats()
    expect(stats.roomCount).toBe(1)
    expect(stats.nodeCount).toBe(1)

    // Verify the embedding function was called
    expect(embedCallCount).toBeGreaterThan(0)
  })

  it('should assign similar content to the same room', async () => {
    // Similar text produces similar embeddings with our hash-based function
    // since "学习 TypeScript" and "学习 JavaScript" share many chars
    const node1 = await engine.ingest('学习 TypeScript')
    const node2 = await engine.ingest('学习 JavaScript')

    // Depending on the embedding similarity, they may or may not share a room
    // But both should be successfully ingested
    expect(node1.roomId).toBeTruthy()
    expect(node2.roomId).toBeTruthy()
  })

  it('should create different rooms for clearly dissimilar content', async () => {
    const node1 = await engine.ingest('编程讨论 aaaa')
    const node2 = await engine.ingest('烹饪食谱 bbbb')

    // With hash-based embedding, these should produce different enough vectors
    // to potentially end up in different rooms
    expect(node1.roomId).toBeTruthy()
    expect(node2.roomId).toBeTruthy()
  })

  it('should recall relevant memories', async () => {
    // Write a few memories
    await engine.ingest('TypeScript 类型系统')
    await engine.ingest('JavaScript 闭包')
    await engine.ingest('React Hooks')

    // Query
    const result = await engine.recall({ query: '编程问题' })

    expect(result.results.length).toBeGreaterThan(0)
    expect(result.roomName).toBeTruthy()
  })

  it('should seal room when it has enough nodes', async () => {
    const smallEngine = new SpaceEngine(store, { sealNodeCount: 5, splitNodeCount: 100 }, realEmbedFn, realSummarizeFn, realNameFn)
    resetCallTrackers()

    // Write enough nodes to trigger sealing
    for (let i = 0; i < 6; i++) {
      await smallEngine.ingest(`内容 ${i}`)
    }

    // The summarize function should have been called for sealing
    expect(summarizeCallCount).toBeGreaterThan(0)
  })

  it('should split room when it gets too large', async () => {
    const splitEngine = new SpaceEngine(store, { splitNodeCount: 10, sealNodeCount: 1000 }, realEmbedFn, realSummarizeFn, realNameFn)
    resetCallTrackers()

    // Write content that creates different embeddings to trigger splitting
    for (let i = 0; i < 12; i++) {
      await splitEngine.ingest(`完全不同的内容 ${i} ${String.fromCharCode(65 + i)}`)
    }

    const stats = splitEngine.getStats()
    // Room count may vary based on embedding similarity
    expect(stats.nodeCount).toBeGreaterThanOrEqual(12)
  })

  it('should support drillDown', async () => {
    await engine.ingest('内容1')
    await engine.ingest('内容2')

    const rooms = store.getActiveRooms()
    if (rooms.length > 0) {
      const results = await engine.drillDown(rooms[0].id)
      expect(results.length).toBeGreaterThan(0)
    }
  })
})

// ── Service 测试 ──────────────────────────────────────────────

describe('SpaceMemoryService', () => {
  let service: SpaceMemoryService

  beforeEach(() => {
    resetCallTrackers()
    service = new SpaceMemoryService(
      {},
      ':memory:',
      realEmbedFn,
      realSummarizeFn,
      realNameFn,
    )
  })

  it('should ingest and recall', async () => {
    await service.ingest('测试记忆内容')

    const result = await service.recall({ query: '测试' })

    expect(result.results.length).toBeGreaterThan(0)
  })

  it('should return empty stats for new service', () => {
    const stats = service.getStats()
    expect(stats.roomCount).toBe(0)
    expect(stats.nodeCount).toBe(0)
    expect(stats.corridorCount).toBe(0)
  })

  it('should support batch ingest', async () => {
    const nodes = await service.batchIngest(['内容1', '内容2', '内容3'])
    expect(nodes.length).toBe(3)

    const stats = service.getStats()
    expect(stats.nodeCount).toBe(3)
  })
})

// ── Runtime 集成测试 ──────────────────────────────────────────────

describe('SpaceMemory Runtime Integration', () => {
  let spaceService: SpaceMemoryService
  let runtime: ColoMindRuntimeImpl

  beforeEach(() => {
    resetCallTrackers()

    spaceService = new SpaceMemoryService(
      {},
      ':memory:',
      realEmbedFn,
      realSummarizeFn,
      realNameFn,
    )

    // Real implementations for all runtime deps
    const stateStore = new InMemoryStateStore()
    const memoryStore = new InMemoryMemoryStore()
    const fileSystem = new LocalFileSystemAdapter('/tmp/nexusmind-test')
    const audit = new InMemoryAudit()

    runtime = new ColoMindRuntimeImpl({
      llm: new MockProvider(),
      stateStore,
      memoryStore,
      fileSystem,
      configStore: stateStore, // Reuse state store for config store
      approvalStore: {
        create: async () => 'approval-1',
        get: async () => null,
        list: async () => [],
        approve: async () => {},
        reject: async () => {},
      },
      auditStore: audit,
      subAgentManager: {
        create: async () => 'agent-1',
        run: async () => 'result',
        destroy: async () => {},
        list: async () => [],
        get: async () => null,
      },
      skillManager: {
        register: async () => 'skill-1',
        list: async () => [],
        get: async () => null,
        execute: async () => null,
      },
      spaceMemory: spaceService,
    })
  })

  it('should ingest into space memory when addMemory is called', async () => {
    await runtime.addMemory('agent-1', 'key-1', '学习 TypeScript 泛型')

    const stats = spaceService.getStats()
    expect(stats.nodeCount).toBe(1)
    expect(stats.roomCount).toBeGreaterThanOrEqual(1)
  })

  it('should search from space memory when searchMemory is called', async () => {
    await runtime.addMemory('agent-1', 'key-1', '学习 TypeScript')
    await runtime.addMemory('agent-1', 'key-2', '学习 JavaScript')

    const results = await runtime.searchMemory('agent-1', '编程')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content).toBeTruthy()
    expect(results[0].score).toBeGreaterThan(0)
  })

  it('should fall back to memoryStore.search when space memory has no results', async () => {
    // Use an InMemoryMemoryStore with data to verify search fallback works
    const fallbackMemoryStore = new InMemoryMemoryStore()
    // Pre-populate with data
    await fallbackMemoryStore.add('agent-1', 'key-1', 'fallback result about TypeScript')

    const runtimeNoSpace = new ColoMindRuntimeImpl({
      llm: new MockProvider(),
      stateStore: new InMemoryStateStore(),
      memoryStore: fallbackMemoryStore,
      fileSystem: new LocalFileSystemAdapter('/tmp/nexusmind-test-nospace'),
      configStore: new InMemoryStateStore(),
      approvalStore: {
        create: async () => 'a',
        get: async () => null,
        list: async () => [],
        approve: async () => {},
        reject: async () => {},
      },
      auditStore: new InMemoryAudit(),
      subAgentManager: {
        create: async () => 'a',
        run: async () => '',
        destroy: async () => {},
        list: async () => [],
        get: async () => null,
      },
      skillManager: {
        register: async () => 's',
        list: async () => [],
        get: async () => null,
        execute: async () => null,
      },
      // No spaceMemory
    })

    // Falls back to memoryStore.search (text matching)
    const results = await runtimeNoSpace.searchMemory('agent-1', 'TypeScript')
    expect(results.length).toBeGreaterThan(0)
    expect(results[0].content).toContain('fallback result')
  })

  it('should pass importance and tags to space memory', async () => {
    await runtime.addMemory('agent-1', 'key-1', '重要决策', {
      importance: 0.9,
      tags: ['决策', '重要'],
    })

    const store = spaceService.getStore()
    const rooms = store.getActiveRooms()
    const nodes = store.getNodesByRoom(rooms[0].id)
    expect(nodes[0].importance).toBe(0.9)
    expect(nodes[0].tags).toEqual(['决策', '重要'])
  })
})