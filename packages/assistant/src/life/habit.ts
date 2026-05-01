/**
 * 习惯追踪模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('Habit')

export type HabitFrequency = 'daily' | 'weekly' | 'monthly'

export interface Habit {
  id: string
  userId: string
  name: string
  frequency: HabitFrequency
  createdAt: string
}

export interface HabitLog {
  id: string
  habitId: string
  loggedAt: string
  note?: string
}

/**
 * 创建习惯
 */
export function createHabit(
  userId: string,
  name: string,
  frequency: HabitFrequency = 'daily',
  db?: Database.Database,
): Habit {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  database
    .prepare(
      `
    INSERT INTO assistant_habits (id, user_id, name, frequency, created_at)
    VALUES (?, ?, ?, ?, ?)
  `,
    )
    .run(id, userId, name, frequency, now)

  logger.info('Created habit', { id, userId, name, frequency })

  return { id, userId, name, frequency, createdAt: now }
}

/**
 * 获取习惯
 */
export function getHabit(id: string, userId: string, db?: Database.Database): Habit | null {
  const database = db || getDb()
  const row = database
    .prepare(`SELECT * FROM assistant_habits WHERE id = ? AND user_id = ?`)
    .get(id, userId) as any
  return row ? rowToHabit(row) : null
}

/**
 * 列出习惯
 */
export function listHabits(userId: string, db?: Database.Database): Habit[] {
  const database = db || getDb()
  const rows = database
    .prepare(`SELECT * FROM assistant_habits WHERE user_id = ? ORDER BY created_at ASC`)
    .all(userId) as any[]
  return rows.map(rowToHabit)
}

/**
 * 删除习惯
 */
export function deleteHabit(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  database.prepare(`DELETE FROM assistant_habit_logs WHERE habit_id = ?`).run(id)
  return (
    database.prepare(`DELETE FROM assistant_habits WHERE id = ? AND user_id = ?`).run(id, userId)
      .changes > 0
  )
}

/**
 * 打卡
 */
export function checkHabit(habitId: string, note?: string, db?: Database.Database): HabitLog {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  database
    .prepare(
      `
    INSERT INTO assistant_habit_logs (id, habit_id, logged_at, note)
    VALUES (?, ?, ?, ?)
  `,
    )
    .run(id, habitId, now, note || null)

  logger.info('Habit checked in', { habitId, note })

  return { id, habitId, loggedAt: now, note }
}

/**
 * 获取打卡记录
 */
export function getHabitLogs(habitId: string, limit = 30, db?: Database.Database): HabitLog[] {
  const database = db || getDb()
  const rows = database
    .prepare(
      `
    SELECT * FROM assistant_habit_logs WHERE habit_id = ? ORDER BY logged_at DESC LIMIT ?
  `,
    )
    .all(habitId, limit) as any[]
  return rows.map(rowToHabitLog)
}

/**
 * 获取连续打卡天数
 */
export function getStreak(habitId: string, db?: Database.Database): number {
  const database = db || getDb()
  const logs = database
    .prepare(
      `
    SELECT date(logged_at) as log_date FROM assistant_habit_logs
    WHERE habit_id = ? GROUP BY date(logged_at) ORDER BY log_date DESC
  `,
    )
    .all(habitId) as any[]

  if (logs.length === 0) return 0

  let streak = 0
  let lastDate = new Date()

  for (const log of logs) {
    const logDate = new Date(log.log_date)
    const diffDays = Math.floor((lastDate.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays <= 1) {
      streak++
      lastDate = logDate
    } else {
      break
    }
  }

  return streak
}

/**
 * 检查今天是否已打卡
 */
export function isTodayChecked(habitId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  const today = new Date().toISOString().split('T')[0]
  const row = database
    .prepare(
      `
    SELECT COUNT(*) as count FROM assistant_habit_logs
    WHERE habit_id = ? AND date(logged_at) = date(?)
  `,
    )
    .get(habitId, today) as any
  return row.count > 0
}

function rowToHabit(row: any): Habit {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    frequency: row.frequency as HabitFrequency,
    createdAt: row.created_at,
  }
}

function rowToHabitLog(row: any): HabitLog {
  return {
    id: row.id,
    habitId: row.habit_id,
    loggedAt: row.logged_at,
    note: row.note || undefined,
  }
}
