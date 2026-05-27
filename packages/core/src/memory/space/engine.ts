/**
 * 语义空间记忆 - 核心引擎
 *
 * ingest: 写入新记忆 → 分配房间
 * seal: 封存房间 → LLM 生成摘要
 * split: 分裂大房间 → K-Means 拆分
 * recall: 检索 → 定位房间 → 取回记忆 → 漫游相邻房间
 */

import type {
  MemoryNode, Room, Corridor, SpaceMemoryConfig,
  SpaceQuery, SpaceSearchResult, SpaceRecallResult, IngestOptions
} from '@colomind/types'
import { createHash } from 'crypto'
import { SpaceStore } from './store.js'
import { findNearestRoom, updateCentroid, kMeansSplit, cosineSimilarity } from './cluster.js'
import { memoryStrength } from './decay.js'

const DEFAULT_CONFIG: SpaceMemoryConfig = {
  enabled: true,
  roomThreshold: 0.3,
  sealNodeCount: 50,
  sealStaleDays: 7,
  splitNodeCount: 100,
  recallTopK: 10,
  corridorMaxHops: 2,
  decayRate: 0.01,
}

export class SpaceEngine {
  private store: SpaceStore
  private config: SpaceMemoryConfig
  private embedFn: (text: string) => Promise<number[]>
  private summarizeFn: (texts: string[], prompt?: string) => Promise<string>
  private nameFn: (texts: string[]) => Promise<string>

  constructor(
    store: SpaceStore,
    config: Partial<SpaceMemoryConfig> = {},
    embedFn: (text: string) => Promise<number[]>,
    summarizeFn: (texts: string[], prompt?: string) => Promise<string>,
    nameFn: (texts: string[]) => Promise<string>,
  ) {
    this.store = store
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.embedFn = embedFn
    this.summarizeFn = summarizeFn
    this.nameFn = nameFn
  }

  // ── Ingest ──────────────────────────────────────────

  async ingest(content: string, options: IngestOptions = {}): Promise<MemoryNode> {
    const embedding = options.embedding ?? await this.embedFn(content)
    const now = Date.now()
    const id = nodeId(content, now)

    // 找最近的房间
    const activeRooms = this.store.getActiveRooms()
    const assignment = findNearestRoom(embedding, activeRooms, this.config.roomThreshold)

    let roomId: string

    if (assignment.room) {
      // 加入已有房间
      roomId = assignment.room.id
      const room = assignment.room
      room.centroid = updateCentroid(room.centroid, room.nodeCount, embedding)
      room.nodeCount += 1
      room.totalTokens += estimateTokens(content)
      room.lastActivity = now
      this.store.updateRoom(room)
    } else {
      // 创建新房间
      roomId = roomIdFromName(`room-${now}`)
      const name = await this.nameFn([content])
      const room: Room = {
        id: roomId,
        name,
        centroid: embedding,
        nodeCount: 1,
        totalTokens: estimateTokens(content),
        createdAt: now,
        lastActivity: now,
        isActive: true,
      }
      this.store.insertRoom(room)
    }

    const node: MemoryNode = {
      id,
      content,
      embedding,
      roomId,
      timestamp: now,
      accessCount: 0,
      lastAccessed: now,
      importance: options.importance ?? 0.5,
      sourceId: options.sourceId,
      tags: options.tags ?? [],
      lifecycle: 'active',
    }

    this.store.insertNode(node)

    // 检查是否需要封存或分裂
    this.checkSeal(roomId)
    this.checkSplit(roomId)

    return node
  }

  // ── Seal ──────────────────────────────────────────

  private checkSeal(roomId: string): void {
    const nodeCount = this.store.getNodeCountByRoom(roomId)
    const room = this.store.getRoom(roomId)
    if (!room) return

    const staleMs = this.config.sealStaleDays * 24 * 60 * 60 * 1000
    const isStale = Date.now() - room.lastActivity > staleMs
    const isFull = nodeCount >= this.config.sealNodeCount

    if (isFull || isStale) {
      this.sealRoom(roomId)
    }
  }

  async sealRoom(roomId: string): Promise<void> {
    const nodes = this.store.getActiveNodesByRoom(roomId)
    if (nodes.length === 0) return

    // LLM 生成房间摘要
    const contents = nodes.map(n => n.content)
    const summary = await this.summarizeFn(contents,
      '请简洁地总结以下所有内容，保留关键事实、决策和时间顺序：')

    // 更新房间摘要
    const room = this.store.getRoom(roomId)
    if (!room) return
    room.summary = summary
    this.store.updateRoom(room)

    // 压缩每个节点
    for (const node of nodes) {
      if (node.content.length > 200) {
        node.compressedContent = await this.summarizeFn([node.content],
          '请用一句话压缩以下内容，保留核心信息：')
      }
      node.lifecycle = 'sealed'
      this.store.updateNode(node)
    }
  }

  // ── Split ──────────────────────────────────────────

  private checkSplit(roomId: string): void {
    const nodeCount = this.store.getNodeCountByRoom(roomId)
    if (nodeCount >= this.config.splitNodeCount) {
      this.splitRoom(roomId)
    }
  }

  async splitRoom(roomId: string): Promise<void> {
    const nodes = this.store.getNodesByRoom(roomId)
    if (nodes.length < 2) return

    const result = kMeansSplit(nodes)

    if (result.groupB.length === 0) return // 无法分裂

    // 为两组创建子房间
    const nodesA = nodes.filter(n => result.groupA.includes(n.id))
    const nodesB = nodes.filter(n => result.groupB.includes(n.id))

    const nameA = await this.nameFn(nodesA.map(n => n.content.slice(0, 200)))
    const nameB = await this.nameFn(nodesB.map(n => n.content.slice(0, 200)))

    const now = Date.now()
    const roomAId = roomIdFromName(nameA)
    const roomBId = roomIdFromName(nameB)

    const roomA: Room = {
      id: roomAId,
      name: nameA,
      centroid: result.centroidA,
      nodeCount: nodesA.length,
      totalTokens: nodesA.reduce((s, n) => s + estimateTokens(n.content), 0),
      createdAt: now,
      lastActivity: now,
      isActive: true,
      parentRoomId: roomId,
    }

    const roomB: Room = {
      id: roomBId,
      name: nameB,
      centroid: result.centroidB,
      nodeCount: nodesB.length,
      totalTokens: nodesB.reduce((s, n) => s + estimateTokens(n.content), 0),
      createdAt: now,
      lastActivity: now,
      isActive: true,
      parentRoomId: roomId,
    }

    this.store.insertRoom(roomA)
    this.store.insertRoom(roomB)

    // 迁移节点到子房间
    for (const node of nodesA) {
      node.roomId = roomAId
      this.store.updateNode(node)
    }
    for (const node of nodesB) {
      node.roomId = roomBId
      this.store.updateNode(node)
    }

    // 原房间变为非活跃
    const parentRoom = this.store.getRoom(roomId)
    if (parentRoom) {
      parentRoom.isActive = false
      parentRoom.summary = `已分裂为 "${nameA}" 和 "${nameB}" 两个子区域`
      this.store.updateRoom(parentRoom)
    }

    // 创建走廊连接两个子房间
    const sharedTags = findSharedTags(nodesA, nodesB)
    const corridor: Corridor = {
      id: `corridor-${roomAId}-${roomBId}`,
      fromRoomId: roomAId,
      toRoomId: roomBId,
      strength: 0.5,
      sharedTags,
    }
    this.store.insertCorridor(corridor)
  }

  // ── Recall ──────────────────────────────────────────

  async recall(query: SpaceQuery): Promise<SpaceRecallResult> {
    const queryEmbedding = query.queryEmbedding ?? await this.embedFn(query.query)
    const maxResults = query.maxResults ?? this.config.recallTopK
    const roam = query.roam ?? true

    // 1. 找最近的房间
    const activeRooms = this.store.getActiveRooms()
    const assignment = findNearestRoom(queryEmbedding, activeRooms, 1.0) // 不限阈值, 总能找到最近的

    let mainRoom: Room | null = null
    let results: SpaceSearchResult[] = []
    let roamRooms: Room[] = []

    if (query.roomId) {
      // 指定房间检索
      mainRoom = this.store.getRoom(query.roomId)
    } else if (assignment.room) {
      mainRoom = assignment.room
    }

    if (!mainRoom) {
      return { roomName: '', results: [], roamRooms: [] }
    }

    // 2. 取出房间内节点, 按相似度排序
    const nodes = this.store.getNodesByRoom(mainRoom.id)
    const scored = nodes.map(node => {
      const sim = cosineSimilarity(queryEmbedding, node.embedding)
      const strength = memoryStrength(
        node.importance, node.accessCount, node.lastAccessed, this.config.decayRate
      )
      return { node, score: sim * 0.7 + strength * 0.3, room: mainRoom!, roamAvailable: false }
    })

    scored.sort((a, b) => b.score - a.score)
    results = scored.slice(0, maxResults)

    // 标记漫游可用性
    const corridors = this.store.getAllCorridorsForRoom(mainRoom.id)
    results = results.map(r => ({ ...r, roamAvailable: corridors.length > 0 }))

    // 3. 漫游相邻房间
    if (roam && corridors.length > 0) {
      const visited = new Set<string>([mainRoom.id])

      for (const corridor of corridors) {
        const neighborId = corridor.fromRoomId === mainRoom.id ? corridor.toRoomId : corridor.fromRoomId
        if (visited.has(neighborId)) continue
        visited.add(neighborId)

        const neighborRoom = this.store.getRoom(neighborId)
        if (!neighborRoom) continue

        roamRooms.push(neighborRoom)

        // 取相邻房间的 top-K
        const neighborNodes = this.store.getNodesByRoom(neighborId)
        const neighborScored = neighborNodes.map(node => {
          const sim = cosineSimilarity(queryEmbedding, node.embedding)
          return { node, score: sim * corridor.strength, room: neighborRoom, roamAvailable: false }
        })
        neighborScored.sort((a, b) => b.score - a.score)

        // 只取相关性高的
        results.push(...neighborScored.filter(r => r.score > 0.3).slice(0, maxResults / 2))
      }

      // 重新排序
      results.sort((a, b) => b.score - a.score)
      results = results.slice(0, maxResults)
    }

    // 更新访问计数
    for (const r of results) {
      this.store.touchNode(r.node.id)
    }

    return {
      roomSummary: mainRoom.summary,
      roomName: mainRoom.name,
      results,
      roamRooms,
    }
  }

  // ── Drill Down ──────────────────────────────────────────

  async drillDown(roomId: string, query?: string, maxResults?: number): Promise<SpaceSearchResult[]> {
    const nodes = this.store.getNodesByRoom(roomId)
    const room = this.store.getRoom(roomId)
    if (!room) return []

    let queryEmbedding: number[] | null = null
    if (query) {
      queryEmbedding = await this.embedFn(query)
    }

    const scored = nodes.map(node => {
      let score = 1
      if (queryEmbedding) {
        score = cosineSimilarity(queryEmbedding, node.embedding)
      }
      return { node, score, room, roamAvailable: false }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, maxResults ?? this.config.recallTopK)
  }

  // ── Batch Ingest ──────────────────────────────────────────

  async batchIngest(contents: string[], options: IngestOptions = {}): Promise<MemoryNode[]> {
    const results: MemoryNode[] = []
    for (const content of contents) {
      const node = await this.ingest(content, options)
      results.push(node)
    }
    return results
  }

  // ── Stats ──────────────────────────────────────────

  getStats() {
    return this.store.getStats()
  }

  // ── 辅助 ──────────────────────────────────────────

  getStore(): SpaceStore {
    return this.store
  }

  getConfig(): SpaceMemoryConfig {
    return this.config
  }
}

// ── ID 生成 ──────────────────────────────────────────────

function nodeId(content: string, timestamp: number): string {
  return createHash('sha256').update(`${content}\0${timestamp}`).digest('hex').slice(0, 32)
}

let _roomIdSeq = 0
function roomIdFromName(name: string): string {
  _roomIdSeq++
  return createHash('sha256').update(`${name}\0${Date.now()}\0${_roomIdSeq}`).digest('hex').slice(0, 24)
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

function findSharedTags(nodesA: MemoryNode[], nodesB: MemoryNode[]): string[] {
  const tagsA = new Set(nodesA.flatMap(n => n.tags))
  const tagsB = new Set(nodesB.flatMap(n => n.tags))
  const shared: string[] = []
  for (const tag of tagsA) {
    if (tagsB.has(tag)) shared.push(tag)
  }
  return shared
}