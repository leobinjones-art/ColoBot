/**
 * 时间追踪模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'

export interface TimeLog {
  id: string
  userId: string
  activity: string
  category?: string
  startedAt: string
  endedAt?: string
  durationMinutes?: number
  note?: string
}

/**
 * 开始时间追踪
 */
export function startTimeLog(
  userId: string,
  activity: string,
  category?: string,
  note?: string,
  db?: Database.Database,
): TimeLog {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  database
    .prepare(
      `
    INSERT INTO assistant_time_logs (id, user_id, activity, category, started_at, note)
    VALUES (?, ?, ?, ?, ?, ?)
  `,
    )
    .run(id, userId, activity, category || null, now, note || null)

  return { id, userId, activity, category, startedAt: now, note }
}

/**
 * 结束时间追踪
 */
export function endTimeLog(id: string, userId: string, db?: Database.Database): TimeLog | null {
  const database = db || getDb()
  const log = getTimeLog(id, userId, database)
  if (!log || log.endedAt) return null

  const now = new Date()
  const started = new Date(log.startedAt)
  const durationMinutes = Math.round((now.getTime() - started.getTime()) / 60000)

  database
    .prepare(
      `
    UPDATE assistant_time_logs SET ended_at = ?, duration_minutes = ? WHERE id = ? AND user_id = ?
  `,
    )
    .run(now.toISOString(), durationMinutes, id, userId)

  return getTimeLog(id, userId, database)
}

/**
 * 获取时间记录
 */
export function getTimeLog(id: string, userId: string, db?: Database.Database): TimeLog | null {
  const database = db || getDb()
  const row = database
    .prepare(`SELECT * FROM assistant_time_logs WHERE id = ? AND user_id = ?`)
    .get(id, userId) as any
  return row ? rowToTimeLog(row) : null
}

/**
 * 获取进行中的追踪
 */
export function getActiveTimeLogs(userId: string, db?: Database.Database): TimeLog[] {
  const database = db || getDb()
  const rows = database
    .prepare(
      `SELECT * FROM assistant_time_logs WHERE user_id = ? AND ended_at IS NULL ORDER BY started_at DESC`,
    )
    .all(userId) as any[]
  return rows.map(rowToTimeLog)
}

/**
 * 获取时间记录列表
 */
export function getTimeLogs(
  userId: string,
  startDate?: string,
  endDate?: string,
  limit = 50,
  db?: Database.Database,
): TimeLog[] {
  const database = db || getDb()
  let sql = `SELECT * FROM assistant_time_logs WHERE user_id = ?`
  const values: any[] = [userId]

  if (startDate) {
    sql += ` AND started_at >= ?`
    values.push(startDate)
  }
  if (endDate) {
    sql += ` AND started_at <= ?`
    values.push(endDate)
  }

  sql += ` ORDER BY started_at DESC LIMIT ?`
  values.push(limit)

  const rows = database.prepare(sql).all(...values) as any[]
  return rows.map(rowToTimeLog)
}

/**
 * 获取时间统计
 */
export function getTimeStats(
  userId: string,
  startDate?: string,
  endDate?: string,
  db?: Database.Database,
): {
  totalMinutes: number
  byCategory: Record<string, number>
  byActivity: Record<string, number>
} {
  const database = db || getDb()
  let sql = `SELECT activity, category, duration_minutes FROM assistant_time_logs WHERE user_id = ? AND ended_at IS NOT NULL`
  const values: any[] = [userId]

  if (startDate) {
    sql += ` AND started_at >= ?`
    values.push(startDate)
  }
  if (endDate) {
    sql += ` AND started_at <= ?`
    values.push(endDate)
  }

  const rows = database.prepare(sql).all(...values) as any[]

  let totalMinutes = 0
  const byCategory: Record<string, number> = {}
  const byActivity: Record<string, number> = {}

  for (const row of rows) {
    const minutes = row.duration_minutes || 0
    totalMinutes += minutes

    if (row.category) {
      byCategory[row.category] = (byCategory[row.category] || 0) + minutes
    }
    byActivity[row.activity] = (byActivity[row.activity] || 0) + minutes
  }

  return { totalMinutes, byCategory, byActivity }
}

/**
 * 删除时间记录
 */
export function deleteTimeLog(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  return (
    database.prepare(`DELETE FROM assistant_time_logs WHERE id = ? AND user_id = ?`).run(id, userId)
      .changes > 0
  )
}

function rowToTimeLog(row: any): TimeLog {
  return {
    id: row.id,
    userId: row.user_id,
    activity: row.activity,
    category: row.category || undefined,
    startedAt: row.started_at,
    endedAt: row.ended_at || undefined,
    durationMinutes: row.duration_minutes || undefined,
    note: row.note || undefined,
  }
}
