/**
 * 日程管理模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'
import { parseTime, parseTimeRange } from '../task/time-parser.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('Calendar')

export interface Event {
  id: string
  userId: string
  title: string
  description?: string
  startAt: string
  endAt?: string
  location?: string
  repeat?: string
  createdAt: string
}

export interface CreateEventInput {
  userId: string
  title: string
  description?: string
  startAt: string | Date
  endAt?: string | Date
  location?: string
  repeat?: string
}

/**
 * 创建日程
 */
export function createEvent(input: CreateEventInput, db?: Database.Database): Event {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  const startAt =
    typeof input.startAt === 'string'
      ? parseTime(input.startAt)?.time.toISOString() || input.startAt
      : input.startAt.toISOString()

  const endAt = input.endAt
    ? typeof input.endAt === 'string'
      ? parseTime(input.endAt)?.time.toISOString() || input.endAt
      : input.endAt.toISOString()
    : null

  const stmt = database.prepare(`
    INSERT INTO assistant_events (id, user_id, title, description, start_at, end_at, location, repeat, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    input.userId,
    input.title,
    input.description || null,
    startAt,
    endAt,
    input.location || null,
    input.repeat || null,
    now,
  )

  logger.info('Created event', { id, userId: input.userId, title: input.title, startAt })

  return {
    id,
    userId: input.userId,
    title: input.title,
    description: input.description,
    startAt,
    endAt: endAt || undefined,
    location: input.location,
    repeat: input.repeat,
    createdAt: now,
  }
}

/**
 * 获取日程
 */
export function getEvent(id: string, userId: string, db?: Database.Database): Event | null {
  const database = db || getDb()
  const stmt = database.prepare(`SELECT * FROM assistant_events WHERE id = ? AND user_id = ?`)
  const row = stmt.get(id, userId) as any
  return row ? rowToEvent(row) : null
}

/**
 * 更新日程
 */
export function updateEvent(
  id: string,
  userId: string,
  input: Partial<CreateEventInput>,
  db?: Database.Database,
): Event | null {
  const database = db || getDb()
  const event = getEvent(id, userId, database)
  if (!event) return null

  const updates: string[] = []
  const values: any[] = []

  if (input.title !== undefined) {
    updates.push('title = ?')
    values.push(input.title)
  }
  if (input.description !== undefined) {
    updates.push('description = ?')
    values.push(input.description)
  }
  if (input.startAt !== undefined) {
    updates.push('start_at = ?')
    values.push(
      typeof input.startAt === 'string'
        ? parseTime(input.startAt)?.time.toISOString() || input.startAt
        : input.startAt.toISOString(),
    )
  }
  if (input.endAt !== undefined) {
    updates.push('end_at = ?')
    values.push(
      input.endAt
        ? typeof input.endAt === 'string'
          ? parseTime(input.endAt)?.time.toISOString() || input.endAt
          : input.endAt.toISOString()
        : null,
    )
  }
  if (input.location !== undefined) {
    updates.push('location = ?')
    values.push(input.location)
  }

  if (updates.length === 0) return event

  values.push(id, userId)
  const stmt = database.prepare(
    `UPDATE assistant_events SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`,
  )
  stmt.run(...values)

  return getEvent(id, userId, database)
}

/**
 * 删除日程
 */
export function deleteEvent(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  const stmt = database.prepare(`DELETE FROM assistant_events WHERE id = ? AND user_id = ?`)
  const result = stmt.run(id, userId)
  const deleted = result.changes > 0
  if (deleted) {
    logger.info('Deleted event', { id, userId })
  } else {
    logger.warn('Event not found for deletion', { id, userId })
  }
  return deleted
}

/**
 * 获取某天的日程
 */
export function getDayEvents(userId: string, date: Date | string, db?: Database.Database): Event[] {
  const database = db || getDb()
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0]
  const stmt = database.prepare(`
    SELECT * FROM assistant_events
    WHERE user_id = ? AND date(start_at) = date(?)
    ORDER BY start_at ASC
  `)
  const rows = stmt.all(userId, dateStr) as any[]
  return rows.map(rowToEvent)
}

/**
 * 获取某周的日程
 */
export function getWeekEvents(
  userId: string,
  date: Date | string = new Date(),
  db?: Database.Database,
): Event[] {
  const database = db || getDb()
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const startOfWeek = new Date(dateObj)
  startOfWeek.setDate(dateObj.getDate() - dateObj.getDay())
  startOfWeek.setHours(0, 0, 0, 0)

  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)
  endOfWeek.setHours(23, 59, 59, 999)

  const stmt = database.prepare(`
    SELECT * FROM assistant_events
    WHERE user_id = ? AND start_at >= ? AND start_at <= ?
    ORDER BY start_at ASC
  `)
  const rows = stmt.all(userId, startOfWeek.toISOString(), endOfWeek.toISOString()) as any[]
  return rows.map(rowToEvent)
}

/**
 * 获取某月的日程
 */
export function getMonthEvents(
  userId: string,
  date: Date | string = new Date(),
  db?: Database.Database,
): Event[] {
  const database = db || getDb()
  const dateObj = typeof date === 'string' ? new Date(date) : date
  const startOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1)
  const endOfMonth = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0, 23, 59, 59, 999)

  const stmt = database.prepare(`
    SELECT * FROM assistant_events
    WHERE user_id = ? AND start_at >= ? AND start_at <= ?
    ORDER BY start_at ASC
  `)
  const rows = stmt.all(userId, startOfMonth.toISOString(), endOfMonth.toISOString()) as any[]
  return rows.map(rowToEvent)
}

/**
 * 检测日程冲突
 */
export function checkConflict(
  userId: string,
  startAt: Date | string,
  endAt: Date | string | null = null,
  db?: Database.Database,
): Event[] {
  const database = db || getDb()
  const startAtObj = typeof startAt === 'string' ? new Date(startAt) : startAt
  const endAtObj = endAt ? (typeof endAt === 'string' ? new Date(endAt) : endAt) : new Date(startAtObj.getTime() + 3600000)

  const stmt = database.prepare(`
    SELECT * FROM assistant_events
    WHERE user_id = ? AND (
      (start_at <= ? AND end_at >= ?) OR
      (start_at >= ? AND start_at <= ?)
    )
    ORDER BY start_at ASC
  `)
  const rows = stmt.all(
    userId,
    startAtObj.toISOString(),
    startAtObj.toISOString(),
    startAtObj.toISOString(),
    endAtObj.toISOString(),
  ) as any[]
  return rows.map(rowToEvent)
}

function rowToEvent(row: any): Event {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || undefined,
    startAt: row.start_at,
    endAt: row.end_at || undefined,
    location: row.location || undefined,
    repeat: row.repeat || undefined,
    createdAt: row.created_at,
  }
}
