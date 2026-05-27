/**
 * 语义空间记忆系统类型定义
 *
 * 基于位置记忆法 (Loci Method)：记忆按语义相似度自动聚类到"房间"，
 * 检索时定位方向 → 到达房间 → 邻近记忆自然浮现 → 需要时沿走廊漫游
 */

// ── 节点生命周期 ──────────────────────────────────────────────

export type NodeLifecycle = 'active' | 'sealed' | 'archived'

// ── 记忆节点 ──────────────────────────────────────────────

export interface MemoryNode {
  /** 确定性 ID: sha256(content, timestamp) */
  id: string
  /** 原始内容 */
  content: string
  /** 向量坐标 (在语义空间中的位置) */
  embedding: number[]
  /** 所属房间 ID */
  roomId: string
  /** 创建时间 (ms) */
  timestamp: number
  /** 被检索次数 (影响衰减) */
  accessCount: number
  /** 最后访问时间 (ms) */
  lastAccessed: number
  /** 重要性 0-1 */
  importance: number
  /** 来源标识 (对话ID等) */
  sourceId?: string
  /** 实体标签 */
  tags: string[]
  /** LLM 压缩后的摘要 (封存后生成) */
  compressedContent?: string
  /** 生命周期 */
  lifecycle: NodeLifecycle
}

// ── 房间 ──────────────────────────────────────────────

export interface Room {
  /** 确定性 ID: sha256(name) */
  id: string
  /** LLM 生成的区域名称 (如"编程讨论") */
  name: string
  /** 房间中心向量 (所有节点均值) */
  centroid: number[]
  /** LLM 生成的房间摘要 */
  summary?: string
  /** 节点数 */
  nodeCount: number
  /** 总 token 数 */
  totalTokens: number
  /** 创建时间 (ms) */
  createdAt: number
  /** 最后活跃时间 (ms) */
  lastActivity: number
  /** 是否仍在活跃接收新记忆 */
  isActive: boolean
  /** 分裂后的父房间 */
  parentRoomId?: string
}

// ── 走廊 ──────────────────────────────────────────────

export interface Corridor {
  /** ID */
  id: string
  /** 起始房间 */
  fromRoomId: string
  /** 目标房间 */
  toRoomId: string
  /** 关联强度 0-1 */
  strength: number
  /** 共享的实体标签 */
  sharedTags: string[]
}

// ── 配置 ──────────────────────────────────────────────

export interface SpaceMemoryConfig {
  /** 是否启用 */
  enabled: boolean
  /** 新 Room 距离阈值 (余弦距离) */
  roomThreshold: number
  /** 封存节点数阈值 */
  sealNodeCount: number
  /** 封存超时天数 */
  sealStaleDays: number
  /** 分裂节点数阈值 */
  splitNodeCount: number
  /** 检索返回数 */
  recallTopK: number
  /** 漫游最大跳数 */
  corridorMaxHops: number
  /** 衰减速率 */
  decayRate: number
  /** 摘要用 LLM 模型 */
  summaryModel?: string
}

// ── 检索 ──────────────────────────────────────────────

export interface SpaceQuery {
  /** 查询文本 */
  query: string
  /** 查询向量 (可选，已有则跳过嵌入) */
  queryEmbedding?: number[]
  /** 限定房间 */
  roomId?: string
  /** 时间范围 */
  timeRange?: { start: number; end: number }
  /** 最大结果数 */
  maxResults?: number
  /** 是否漫游相邻房间 */
  roam?: boolean
}

export interface SpaceSearchResult {
  /** 记忆节点 */
  node: MemoryNode
  /** 相似度分数 */
  score: number
  /** 所属房间 */
  room: Room
  /** 是否有相邻房间可漫游 */
  roamAvailable: boolean
}

export interface SpaceRecallResult {
  /** 主房间摘要 */
  roomSummary?: string
  /** 主房间名称 */
  roomName: string
  /** 检索到的记忆节点 */
  results: SpaceSearchResult[]
  /** 漫游到的相邻房间 */
  roamRooms: Room[]
}

// ── 写入 ──────────────────────────────────────────────

export interface IngestOptions {
  /** 来源标识 */
  sourceId?: string
  /** 重要性 */
  importance?: number
  /** 实体标签 */
  tags?: string[]
  /** 已有向量 (跳过嵌入) */
  embedding?: number[]
}