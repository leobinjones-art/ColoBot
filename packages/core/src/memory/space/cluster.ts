/**
 * 语义空间记忆 - 聚类算法
 *
 * 房间分配: 余弦距离找最近房间
 * 房间分裂: K-means (k=2) 将大房间拆为两个子房间
 */

import type { MemoryNode, Room } from '@colomind/types'

// ── 余弦相似度 ──────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export function cosineDistance(a: number[], b: number[]): number {
  return 1 - cosineSimilarity(a, b)
}

// ── 房间分配 ──────────────────────────────────────────────

export interface RoomAssignment {
  /** 最近的房间, null 表示需要创建新房间 */
  room: Room | null
  /** 到最近房间的余弦距离 */
  distance: number
}

/**
 * 找到与给定向量最近的活跃房间
 */
export function findNearestRoom(
  embedding: number[],
  rooms: Room[],
  threshold: number
): RoomAssignment {
  if (rooms.length === 0) {
    return { room: null, distance: Infinity }
  }

  let bestRoom: Room | null = null
  let bestDist = Infinity

  for (const room of rooms) {
    if (!room.isActive || room.centroid.length === 0) continue
    const dist = cosineDistance(embedding, room.centroid)
    if (dist < bestDist) {
      bestDist = dist
      bestRoom = room
    }
  }

  // 距离超过阈值, 建议创建新房间
  if (bestDist > threshold) {
    return { room: null, distance: bestDist }
  }

  return { room: bestRoom, distance: bestDist }
}

// ── 质心更新 ──────────────────────────────────────────────

/**
 * 增量更新房间质心 (加入新节点后)
 */
export function updateCentroid(
  currentCentroid: number[],
  currentCount: number,
  newEmbedding: number[]
): number[] {
  if (currentCentroid.length === 0) return newEmbedding
  if (currentCentroid.length !== newEmbedding.length) return currentCentroid

  const newCount = currentCount + 1
  return currentCentroid.map((c, i) => (c * currentCount + newEmbedding[i]) / newCount)
}

// ── K-Means 分裂 ──────────────────────────────────────────────

export interface SplitResult {
  /** 分组 A 的节点 ID */
  groupA: string[]
  /** 分组 B 的节点 ID */
  groupB: string[]
  /** 分组 A 的质心 */
  centroidA: number[]
  /** 分组 B 的质心 */
  centroidB: number[]
}

/**
 * K-Means (k=2) 将房间内节点分成两组
 */
export function kMeansSplit(nodes: MemoryNode[], maxIter = 20): SplitResult {
  if (nodes.length < 2) {
    return {
      groupA: nodes.map(n => n.id),
      groupB: [],
      centroidA: nodes[0]?.embedding ?? [],
      centroidB: [],
    }
  }

  // 初始化: 选距离最远的两个节点作为初始质心
  const [seedA, seedB] = findFarthestPair(nodes)
  let centroidA = [...seedA.embedding]
  let centroidB = [...seedB.embedding]

  let groupA: string[] = []
  let groupB: string[] = []

  for (let iter = 0; iter < maxIter; iter++) {
    const newGroupA: string[] = []
    const newGroupB: string[] = []

    for (const node of nodes) {
      const distA = cosineDistance(node.embedding, centroidA)
      const distB = cosineDistance(node.embedding, centroidB)
      if (distA <= distB) {
        newGroupA.push(node.id)
      } else {
        newGroupB.push(node.id)
      }
    }

    // 收敛检查
    if (
      setsEqual(new Set(newGroupA), new Set(groupA)) &&
      setsEqual(new Set(newGroupB), new Set(groupB))
    ) {
      break
    }

    groupA = newGroupA
    groupB = newGroupB

    // 重新计算质心
    const nodesA = nodes.filter(n => groupA.includes(n.id))
    const nodesB = nodes.filter(n => groupB.includes(n.id))
    centroidA = computeMean(nodesA.map(n => n.embedding))
    centroidB = computeMean(nodesB.map(n => n.embedding))
  }

  return { groupA, groupB, centroidA, centroidB }
}

// ── 辅助函数 ──────────────────────────────────────────────

function findFarthestPair(nodes: MemoryNode[]): [MemoryNode, MemoryNode] {
  let maxDist = -1
  let bestA = nodes[0]
  let bestB = nodes[1]

  // 采样避免 O(n²) 全量计算
  const sample = nodes.length > 50 ? sampleArray(nodes, 50) : nodes

  for (let i = 0; i < sample.length; i++) {
    for (let j = i + 1; j < sample.length; j++) {
      const dist = cosineDistance(sample[i].embedding, sample[j].embedding)
      if (dist > maxDist) {
        maxDist = dist
        bestA = sample[i]
        bestB = sample[j]
      }
    }
  }

  return [bestA, bestB]
}

function computeMean(embeddings: number[][]): number[] {
  if (embeddings.length === 0) return []
  const dim = embeddings[0].length
  const mean = new Array(dim).fill(0)
  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      mean[i] += emb[i]
    }
  }
  for (let i = 0; i < dim; i++) {
    mean[i] /= embeddings.length
  }
  return mean
}

function sampleArray<T>(arr: T[], size: number): T[] {
  const shuffled = [...arr]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled.slice(0, size)
}

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const item of a) {
    if (!b.has(item)) return false
  }
  return true
}
