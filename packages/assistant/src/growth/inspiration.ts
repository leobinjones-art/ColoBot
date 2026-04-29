/**
 * 灵感笔记模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'

export interface Inspiration {
  id: string
  userId: string
  content: string
  tags: string[]
  createdAt: string
}

/**
 * 记录灵感
 */
export function addInspiration(
  userId: string,
  content: string,
  tags: string[] = [],
  db?: Database.Database,
): Inspiration {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  database
    .prepare(
      `
    INSERT INTO assistant_inspirations (id, user_id, content, tags, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(id, userId, content, JSON.stringify(tags), now)

  return { id, userId, content, tags, createdAt: now }
}

/**
 * 获取灵感
 */
export function getInspiration(
  id: string,
  userId: string,
  db?: Database.Database,
): Inspiration | null {
  const database = db || getDb()
  const row = database
    .prepare(`SELECT * FROM assistant_inspirations WHERE id = ? AND user_id = ?`)
    .get(id, userId) as any
  return row ? rowToInspiration(row) : null
}

/**
 * 列出灵感
 */
export function listInspirations(
  userId: string,
  tag?: string,
  limit = 50,
  db?: Database.Database,
): Inspiration[] {
  const database = db || getDb()
  let sql = `SELECT * FROM assistant_inspirations WHERE user_id = ?`
  const values: any[] = [userId]

  if (tag) {
    sql += ` AND tags LIKE ?`
    values.push(`%"${tag}"%`)
  }

  sql += ` ORDER BY created_at DESC LIMIT ?`
  values.push(limit)

  const rows = database.prepare(sql).all(...values) as any[]
  return rows.map(rowToInspiration)
}

/**
 * 搜索灵感
 */
export function searchInspirations(
  userId: string,
  query: string,
  db?: Database.Database,
): Inspiration[] {
  const database = db || getDb()
  const rows = database
    .prepare(
      `
    SELECT * FROM assistant_inspirations WHERE user_id = ? AND content LIKE ?
    ORDER BY created_at DESC
  `,
    )
    .all(userId, `%${query}%`) as any[]
  return rows.map(rowToInspiration)
}

/**
 * 删除灵感
 */
export function deleteInspiration(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  return (
    database
      .prepare(`DELETE FROM assistant_inspirations WHERE id = ? AND user_id = ?`)
      .run(id, userId).changes > 0
  )
}

function rowToInspiration(row: any): Inspiration {
  return {
    id: row.id,
    userId: row.user_id,
    content: row.content,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
  }
}
