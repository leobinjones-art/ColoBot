/**
 * 阅读清单模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('Reading')

export type ReadingType = 'book' | 'article' | 'paper'
export type ReadingStatus = 'pending' | 'reading' | 'done'

export interface Reading {
  id: string
  userId: string
  title: string
  author?: string
  type: ReadingType
  status: ReadingStatus
  progress: number // 0-100
  note?: string
  createdAt: string
}

/**
 * 添加阅读项
 */
export function addReading(
  userId: string,
  title: string,
  type: ReadingType = 'book',
  author?: string,
  db?: Database.Database,
): Reading {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  database
    .prepare(
      `
    INSERT INTO assistant_readings (id, user_id, title, author, type, status, progress, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(id, userId, title, author || null, type, 'pending', 0, now)

  logger.info('Added reading', { id, userId, title, type })

  return { id, userId, title, author, type, status: 'pending', progress: 0, createdAt: now }
}

/**
 * 更新阅读进度
 */
export function updateReadingProgress(
  id: string,
  userId: string,
  progress: number,
  note?: string,
  db?: Database.Database,
): Reading | null {
  const database = db || getDb()
  const reading = getReading(id, userId, database)
  if (!reading) {
    logger.warn('Reading not found for update', { id, userId })
    return null
  }

  const status = progress >= 100 ? 'done' : progress > 0 ? 'reading' : 'pending'

  database
    .prepare(
      `
    UPDATE assistant_readings SET progress = ?, status = ?, note = ? WHERE id = ? AND user_id = ?
  `,
    )
    .run(progress, status, note || reading.note, id, userId)

  logger.info('Updated reading progress', { id, userId, progress, status })

  return getReading(id, userId, database)
}

/**
 * 获取阅读项
 */
export function getReading(id: string, userId: string, db?: Database.Database): Reading | null {
  const database = db || getDb()
  const row = database
    .prepare(`SELECT * FROM assistant_readings WHERE id = ? AND user_id = ?`)
    .get(id, userId) as any
  return row ? rowToReading(row) : null
}

/**
 * 列出阅读项
 */
export function listReadings(
  userId: string,
  status?: ReadingStatus,
  db?: Database.Database,
): Reading[] {
  const database = db || getDb()
  let sql = `SELECT * FROM assistant_readings WHERE user_id = ?`
  const values: any[] = [userId]

  if (status) {
    sql += ` AND status = ?`
    values.push(status)
  }

  sql += ` ORDER BY created_at DESC`
  const rows = database.prepare(sql).all(...values) as any[]
  return rows.map(rowToReading)
}

/**
 * 删除阅读项
 */
export function deleteReading(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  const result = database
    .prepare(`DELETE FROM assistant_readings WHERE id = ? AND user_id = ?`)
    .run(id, userId)
  const deleted = result.changes > 0
  if (deleted) {
    logger.info('Deleted reading', { id, userId })
  } else {
    logger.warn('Reading not found for deletion', { id, userId })
  }
  return deleted
}

function rowToReading(row: any): Reading {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    author: row.author || undefined,
    type: row.type as ReadingType,
    status: row.status as ReadingStatus,
    progress: row.progress,
    note: row.note || undefined,
    createdAt: row.created_at,
  }
}
