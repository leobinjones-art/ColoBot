/**
 * 健康追踪模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'

export interface HealthEntry {
  id: string
  userId: string
  type: 'exercise' | 'sleep' | 'weight' | 'water' | 'meal'
  value: number
  unit: string
  note?: string
  loggedAt: string
}

/**
 * 记录健康数据
 */
export function logHealth(
  userId: string,
  type: HealthEntry['type'],
  value: number,
  unit: string,
  note?: string,
  db?: Database.Database,
): HealthEntry {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  database
    .prepare(
      `
    INSERT INTO assistant_health (id, user_id, type, value, unit, note, logged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(id, userId, type, value, unit, note || null, now)

  return { id, userId, type, value, unit, note, loggedAt: now }
}

/**
 * 记录运动
 */
export function logExercise(
  userId: string,
  minutes: number,
  note?: string,
  db?: Database.Database,
): HealthEntry {
  return logHealth(userId, 'exercise', minutes, 'minutes', note, db)
}

/**
 * 记录睡眠
 */
export function logSleep(
  userId: string,
  hours: number,
  note?: string,
  db?: Database.Database,
): HealthEntry {
  return logHealth(userId, 'sleep', hours, 'hours', note, db)
}

/**
 * 记录体重
 */
export function logWeight(
  userId: string,
  kg: number,
  note?: string,
  db?: Database.Database,
): HealthEntry {
  return logHealth(userId, 'weight', kg, 'kg', note, db)
}

/**
 * 记录饮水
 */
export function logWater(userId: string, ml: number, db?: Database.Database): HealthEntry {
  return logHealth(userId, 'water', ml, 'ml', undefined, db)
}

/**
 * 获取健康记录
 */
export function getHealthEntries(
  userId: string,
  type?: HealthEntry['type'],
  limit = 30,
  db?: Database.Database,
): HealthEntry[] {
  const database = db || getDb()
  let sql = `SELECT * FROM assistant_health WHERE user_id = ?`
  const values: any[] = [userId]

  if (type) {
    sql += ` AND type = ?`
    values.push(type)
  }

  sql += ` ORDER BY logged_at DESC LIMIT ?`
  values.push(limit)

  const rows = database.prepare(sql).all(...values) as any[]
  return rows.map(rowToHealth)
}

/**
 * 获取健康统计
 */
export function getHealthStats(
  userId: string,
  days = 7,
  db?: Database.Database,
): {
  totalExercise: number
  avgSleep: number
  latestWeight: number | null
  totalWater: number
} {
  const database = db || getDb()
  const rows = database
    .prepare(
      `
    SELECT type, value FROM assistant_health
    WHERE user_id = ? AND logged_at >= datetime('now', '-' || ? || ' days')
  `,
    )
    .all(userId, days) as any[]

  let totalExercise = 0
  let totalSleep = 0
  let sleepCount = 0
  let latestWeight: number | null = null
  let totalWater = 0

  for (const row of rows) {
    switch (row.type) {
      case 'exercise':
        totalExercise += row.value
        break
      case 'sleep':
        totalSleep += row.value
        sleepCount++
        break
      case 'weight':
        latestWeight = row.value
        break
      case 'water':
        totalWater += row.value
        break
    }
  }

  return {
    totalExercise,
    avgSleep: sleepCount > 0 ? totalSleep / sleepCount : 0,
    latestWeight,
    totalWater,
  }
}

function rowToHealth(row: any): HealthEntry {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    value: row.value,
    unit: row.unit,
    note: row.note || undefined,
    loggedAt: row.logged_at,
  }
}
