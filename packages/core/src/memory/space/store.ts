/**
 * 语义空间记忆 - 存储层
 */

import type { MemoryNode, Room, Corridor, NodeLifecycle } from '@colomind/types'
import { SPACE_SCHEMA } from './schema.js'

// ── 序列化工具 ──────────────────────────────────────────────

function embeddingToBuffer(embedding: number[]): Buffer {
  const buf = Buffer.alloc(embedding.length * 4)
  for (let i = 0; i < embedding.length; i++) {
    buf.writeFloatLE(embedding[i], i * 4)
  }
  return buf
}

function bufferToEmbedding(buf: Buffer, dim: number): number[] {
  const arr: number[] = new Array(dim)
  for (let i = 0; i < dim; i++) {
    arr[i] = buf.readFloatLE(i * 4)
  }
  return arr
}

function getEmbeddingDim(buf: Buffer | null): number {
  return buf ? buf.length / 4 : 0
}

// ── Store ──────────────────────────────────────────────

export class SpaceStore {
  private db: any // better-sqlite3.Database
  private embeddingDim = 0

  constructor(db: any) {
    this.db = db
    this.init()
  }

  private init() {
    this.db.exec(SPACE_SCHEMA)
  }

  // ── Room CRUD ──────────────────────────────────────────

  insertRoom(room: Room): void {
    const centroidBuf = room.centroid.length > 0 ? embeddingToBuffer(room.centroid) : null
    if (centroidBuf && !this.embeddingDim) {
      this.embeddingDim = room.centroid.length
    }
    this.db.prepare(`
      INSERT INTO space_rooms (id, name, centroid, summary, node_count, total_tokens, created_at, last_activity, is_active, parent_room_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      room.id, room.name, centroidBuf, room.summary ?? null,
      room.nodeCount, room.totalTokens, room.createdAt, room.lastActivity,
      room.isActive ? 1 : 0, room.parentRoomId ?? null
    )
  }

  getRoom(id: string): Room | null {
    const row = this.db.prepare('SELECT * FROM space_rooms WHERE id = ?').get(id) as any
    return row ? this.rowToRoom(row) : null
  }

  getActiveRooms(): Room[] {
    const rows = this.db.prepare('SELECT * FROM space_rooms WHERE is_active = 1').all() as any[]
    return rows.map(r => this.rowToRoom(r))
  }

  getAllRooms(): Room[] {
    const rows = this.db.prepare('SELECT * FROM space_rooms').all() as any[]
    return rows.map(r => this.rowToRoom(r))
  }

  updateRoom(room: Room): void {
    const centroidBuf = room.centroid.length > 0 ? embeddingToBuffer(room.centroid) : null
    this.db.prepare(`
      UPDATE space_rooms SET name = ?, centroid = ?, summary = ?, node_count = ?,
        total_tokens = ?, last_activity = ?, is_active = ?, parent_room_id = ?
      WHERE id = ?
    `).run(
      room.name, centroidBuf, room.summary ?? null,
      room.nodeCount, room.totalTokens, room.lastActivity,
      room.isActive ? 1 : 0, room.parentRoomId ?? null, room.id
    )
  }

  // ── Node CRUD ──────────────────────────────────────────

  insertNode(node: MemoryNode): void {
    const embBuf = node.embedding.length > 0 ? embeddingToBuffer(node.embedding) : null
    if (embBuf && !this.embeddingDim) {
      this.embeddingDim = node.embedding.length
    }
    this.db.prepare(`
      INSERT INTO space_nodes (id, content, embedding, room_id, timestamp, access_count,
        last_accessed, importance, source_id, tags, compressed_content, lifecycle)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      node.id, node.content, embBuf, node.roomId, node.timestamp,
      node.accessCount, node.lastAccessed, node.importance,
      node.sourceId ?? null, JSON.stringify(node.tags),
      node.compressedContent ?? null, node.lifecycle
    )
  }

  getNode(id: string): MemoryNode | null {
    const row = this.db.prepare('SELECT * FROM space_nodes WHERE id = ?').get(id) as any
    return row ? this.rowToNode(row) : null
  }

  getNodesByRoom(roomId: string, lifecycle?: NodeLifecycle): MemoryNode[] {
    let sql = 'SELECT * FROM space_nodes WHERE room_id = ?'
    const params: any[] = [roomId]
    if (lifecycle) {
      sql += ' AND lifecycle = ?'
      params.push(lifecycle)
    }
    sql += ' ORDER BY timestamp DESC'
    const rows = this.db.prepare(sql).all(...params) as any[]
    return rows.map(r => this.rowToNode(r))
  }

  getActiveNodesByRoom(roomId: string): MemoryNode[] {
    return this.getNodesByRoom(roomId, 'active')
  }

  updateNode(node: MemoryNode): void {
    const embBuf = node.embedding.length > 0 ? embeddingToBuffer(node.embedding) : null
    this.db.prepare(`
      UPDATE space_nodes SET content = ?, embedding = ?, room_id = ?, access_count = ?,
        last_accessed = ?, importance = ?, tags = ?, compressed_content = ?, lifecycle = ?
      WHERE id = ?
    `).run(
      node.content, embBuf, node.roomId, node.accessCount,
      node.lastAccessed, node.importance,
      JSON.stringify(node.tags), node.compressedContent ?? null,
      node.lifecycle, node.id
    )
  }

  touchNode(id: string): void {
    this.db.prepare(`
      UPDATE space_nodes SET access_count = access_count + 1, last_accessed = ?
      WHERE id = ?
    `).run(Date.now(), id)
  }

  getNodeCountByRoom(roomId: string): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM space_nodes WHERE room_id = ?').get(roomId) as any
    return row.count
  }

  getStaleRooms(staleDays: number): Room[] {
    const cutoff = Date.now() - staleDays * 24 * 60 * 60 * 1000
    const rows = this.db.prepare(
      'SELECT * FROM space_rooms WHERE is_active = 1 AND last_activity < ?'
    ).all(cutoff) as any[]
    return rows.map(r => this.rowToRoom(r))
  }

  // ── Corridor CRUD ──────────────────────────────────────

  insertCorridor(corridor: Corridor): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO space_corridors (id, from_room_id, to_room_id, strength, shared_tags)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      corridor.id, corridor.fromRoomId, corridor.toRoomId,
      corridor.strength, JSON.stringify(corridor.sharedTags)
    )
  }

  getCorridorsFrom(roomId: string): Corridor[] {
    const rows = this.db.prepare(
      'SELECT * FROM space_corridors WHERE from_room_id = ? ORDER BY strength DESC'
    ).all(roomId) as any[]
    return rows.map(r => this.rowToCorridor(r))
  }

  getCorridorsTo(roomId: string): Corridor[] {
    const rows = this.db.prepare(
      'SELECT * FROM space_corridors WHERE to_room_id = ? ORDER BY strength DESC'
    ).all(roomId) as any[]
    return rows.map(r => this.rowToCorridor(r))
  }

  getAllCorridorsForRoom(roomId: string): Corridor[] {
    const rows = this.db.prepare(
      'SELECT * FROM space_corridors WHERE from_room_id = ? OR to_room_id = ? ORDER BY strength DESC'
    ).all(roomId, roomId) as any[]
    return rows.map(r => this.rowToCorridor(r))
  }

  deleteCorridor(id: string): void {
    this.db.prepare('DELETE FROM space_corridors WHERE id = ?').run(id)
  }

  // ── Batch ──────────────────────────────────────────

  batchInsertNodes(nodes: MemoryNode[]): void {
    const insert = this.db.prepare(`
      INSERT INTO space_nodes (id, content, embedding, room_id, timestamp, access_count,
        last_accessed, importance, source_id, tags, compressed_content, lifecycle)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const txn = this.db.transaction((items: MemoryNode[]) => {
      for (const node of items) {
        const embBuf = node.embedding.length > 0 ? embeddingToBuffer(node.embedding) : null
        insert.run(
          node.id, node.content, embBuf, node.roomId, node.timestamp,
          node.accessCount, node.lastAccessed, node.importance,
          node.sourceId ?? null, JSON.stringify(node.tags),
          node.compressedContent ?? null, node.lifecycle
        )
      }
    })
    txn(nodes)
  }

  // ── Stats ──────────────────────────────────────────

  getStats(): { roomCount: number; nodeCount: number; corridorCount: number } {
    const rooms = this.db.prepare('SELECT COUNT(*) as c FROM space_rooms').get() as any
    const nodes = this.db.prepare('SELECT COUNT(*) as c FROM space_nodes').get() as any
    const corridors = this.db.prepare('SELECT COUNT(*) as c FROM space_corridors').get() as any
    return {
      roomCount: rooms.c,
      nodeCount: nodes.c,
      corridorCount: corridors.c,
    }
  }

  // ── Row 转换 ──────────────────────────────────────────

  private rowToRoom(row: any): Room {
    const dim = getEmbeddingDim(row.centroid)
    return {
      id: row.id,
      name: row.name,
      centroid: row.centroid ? bufferToEmbedding(row.centroid, dim) : [],
      summary: row.summary ?? undefined,
      nodeCount: row.node_count,
      totalTokens: row.total_tokens,
      createdAt: row.created_at,
      lastActivity: row.last_activity,
      isActive: row.is_active === 1,
      parentRoomId: row.parent_room_id ?? undefined,
    }
  }

  private rowToNode(row: any): MemoryNode {
    const dim = getEmbeddingDim(row.embedding)
    return {
      id: row.id,
      content: row.content,
      embedding: row.embedding ? bufferToEmbedding(row.embedding, dim) : [],
      roomId: row.room_id,
      timestamp: row.timestamp,
      accessCount: row.access_count,
      lastAccessed: row.last_accessed,
      importance: row.importance,
      sourceId: row.source_id ?? undefined,
      tags: JSON.parse(row.tags),
      compressedContent: row.compressed_content ?? undefined,
      lifecycle: row.lifecycle,
    }
  }

  private rowToCorridor(row: any): Corridor {
    return {
      id: row.id,
      fromRoomId: row.from_room_id,
      toRoomId: row.to_room_id,
      strength: row.strength,
      sharedTags: JSON.parse(row.shared_tags),
    }
  }
}
