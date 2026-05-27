/**
 * 财务管理模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'
import { FinanceRow } from '../db/types.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('Finance')

export type FinanceType = 'income' | 'expense'

export interface FinanceEntry {
  id: string
  userId: string
  type: FinanceType
  amount: number
  category?: string
  note?: string
  loggedAt: string
}

export interface FinanceStats {
  totalIncome: number
  totalExpense: number
  balance: number
  byCategory: Record<string, number>
}

/**
 * 记录收支
 */
export function logFinance(
  userId: string,
  type: FinanceType,
  amount: number,
  category?: string,
  note?: string,
  db?: Database.Database,
): FinanceEntry {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  database
    .prepare(
      `
    INSERT INTO assistant_finances (id, user_id, type, amount, category, note, logged_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(id, userId, type, amount, category || null, note || null, now)

  logger.info('Logged finance', { id, userId, type, amount, category })

  return { id, userId, type, amount, category, note, loggedAt: now }
}

/**
 * 获取收支记录
 */
export function getFinanceEntries(
  userId: string,
  type?: FinanceType,
  limit = 30,
  db?: Database.Database,
): FinanceEntry[] {
  const database = db || getDb()
  let sql = `SELECT * FROM assistant_finances WHERE user_id = ?`
  const values: (string | number | null)[] = [userId]

  if (type) {
    sql += ` AND type = ?`
    values.push(type)
  }

  sql += ` ORDER BY logged_at DESC LIMIT ?`
  values.push(limit)

  const rows = database.prepare(sql).all(...values) as FinanceRow[]
  return rows.map(rowToFinance)
}

/**
 * 获取财务统计
 */
export function getFinanceStats(
  userId: string,
  startDate?: string,
  endDate?: string,
  db?: Database.Database,
): FinanceStats {
  const database = db || getDb()
  let sql = `SELECT type, amount, category FROM assistant_finances WHERE user_id = ?`
  const values: (string | number | null)[] = [userId]

  if (startDate) {
    sql += ` AND logged_at >= ?`
    values.push(startDate)
  }
  if (endDate) {
    sql += ` AND logged_at <= ?`
    values.push(endDate)
  }

  const rows = database.prepare(sql).all(...values) as FinanceRow[]

  let totalIncome = 0
  let totalExpense = 0
  const byCategory: Record<string, number> = {}

  for (const row of rows) {
    if (row.type === 'income') {
      totalIncome += row.amount
    } else {
      totalExpense += row.amount
    }

    if (row.category) {
      byCategory[row.category] = (byCategory[row.category] || 0) + row.amount
    }
  }

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory,
  }
}

/**
 * 获取本月统计
 */
export function getMonthlyStats(userId: string, db?: Database.Database): FinanceStats {
  const database = db || getDb()
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  return getFinanceStats(userId, startOfMonth, undefined, database)
}

/**
 * 删除记录
 */
export function deleteFinanceEntry(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  return (
    database.prepare(`DELETE FROM assistant_finances WHERE id = ? AND user_id = ?`).run(id, userId)
      .changes > 0
  )
}

function rowToFinance(row: FinanceRow): FinanceEntry {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as FinanceType,
    amount: row.amount,
    category: row.category || undefined,
    note: row.note || undefined,
    loggedAt: row.logged_at,
  }
}
