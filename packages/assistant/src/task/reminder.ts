/**
 * 提醒模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'
import { parseTime, formatTime } from './time-parser.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('Reminder')

export type ReminderRepeat = 'none' | 'daily' | 'weekly' | 'monthly'
export type ReminderStatus = 'pending' | 'done' | 'cancelled'

export interface Reminder {
  id: string
  userId: string
  title: string
  content?: string
  remindAt: string
  repeat: ReminderRepeat
  status: ReminderStatus
  createdAt: string
}

export interface CreateReminderInput {
  userId: string
  title: string
  content?: string
  remindAt: string | Date
  repeat?: ReminderRepeat
}

// 提醒检查定时器
let checkInterval: ReturnType<typeof setInterval> | null = null
const reminderCallbacks: Array<(reminder: Reminder) => void> = []

/**
 * 创建提醒
 */
export function createReminder(input: CreateReminderInput, db?: Database.Database): Reminder {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  const remindAt =
    typeof input.remindAt === 'string'
      ? parseTime(input.remindAt)?.time.toISOString() || input.remindAt
      : input.remindAt.toISOString()

  const stmt = database.prepare(`
    INSERT INTO assistant_reminders (id, user_id, title, content, remind_at, repeat, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `)

  stmt.run(
    id,
    input.userId,
    input.title,
    input.content || null,
    remindAt,
    input.repeat || 'none',
    now,
  )

  logger.info('Created reminder', { id, userId: input.userId, title: input.title, remindAt })

  return {
    id,
    userId: input.userId,
    title: input.title,
    content: input.content,
    remindAt,
    repeat: input.repeat || 'none',
    status: 'pending',
    createdAt: now,
  }
}

/**
 * 获取提醒
 */
export function getReminder(id: string, userId: string, db?: Database.Database): Reminder | null {
  const database = db || getDb()
  const stmt = database.prepare(`SELECT * FROM assistant_reminders WHERE id = ? AND user_id = ?`)
  const row = stmt.get(id, userId) as any
  return row ? rowToReminder(row) : null
}

/**
 * 列出提醒
 */
export function listReminders(
  userId: string,
  status?: ReminderStatus,
  db?: Database.Database,
): Reminder[] {
  const database = db || getDb()
  let sql = `SELECT * FROM assistant_reminders WHERE user_id = ?`
  const values: any[] = [userId]

  if (status) {
    sql += ` AND status = ?`
    values.push(status)
  }

  sql += ` ORDER BY remind_at ASC`

  const stmt = database.prepare(sql)
  const rows = stmt.all(...values) as any[]
  return rows.map(rowToReminder)
}

/**
 * 获取待触发的提醒
 */
export function getPendingReminders(db?: Database.Database): Reminder[] {
  const database = db || getDb()
  const now = new Date().toISOString()
  const stmt = database.prepare(`
    SELECT * FROM assistant_reminders
    WHERE status = 'pending' AND remind_at <= ?
    ORDER BY remind_at ASC
  `)
  const rows = stmt.all(now) as any[]
  return rows.map(rowToReminder)
}

/**
 * 完成提醒
 */
export function completeReminder(
  id: string,
  userId: string,
  db?: Database.Database,
): Reminder | null {
  const database = db || getDb()
  const reminder = getReminder(id, userId, database)
  if (!reminder) {
    logger.warn('Reminder not found for completion', { id, userId })
    return null
  }

  // 如果是重复提醒，计算下次时间
  if (reminder.repeat !== 'none') {
    const nextTime = calculateNextTime(new Date(reminder.remindAt), reminder.repeat)
    const stmt = database.prepare(`UPDATE assistant_reminders SET remind_at = ? WHERE id = ?`)
    stmt.run(nextTime.toISOString(), id)
    logger.info('Rescheduled repeating reminder', { id, repeat: reminder.repeat, nextTime })
    return getReminder(id, userId, database)
  }

  // 非重复提醒，标记为完成
  const stmt = database.prepare(`UPDATE assistant_reminders SET status = 'done' WHERE id = ?`)
  stmt.run(id)
  logger.info('Completed reminder', { id, userId })
  return getReminder(id, userId, database)
}

/**
 * 取消提醒
 */
export function cancelReminder(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  const stmt = database.prepare(
    `UPDATE assistant_reminders SET status = 'cancelled' WHERE id = ? AND user_id = ?`,
  )
  const result = stmt.run(id, userId)
  return result.changes > 0
}

/**
 * 删除提醒
 */
export function deleteReminder(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  const stmt = database.prepare(`DELETE FROM assistant_reminders WHERE id = ? AND user_id = ?`)
  const result = stmt.run(id, userId)
  return result.changes > 0
}

/**
 * 注册提醒回调
 */
export function onReminder(callback: (reminder: Reminder) => void): void {
  reminderCallbacks.push(callback)
}

/**
 * 启动提醒检查
 */
export function startReminderCheck(intervalMs: number = 60000): void {
  if (checkInterval) return

  logger.info('Started reminder check', { intervalMs })

  checkInterval = setInterval(() => {
    const pending = getPendingReminders()
    if (pending.length > 0) {
      logger.debug('Found pending reminders', { count: pending.length })
    }
    for (const reminder of pending) {
      logger.info('Triggering reminder', { id: reminder.id, title: reminder.title })
      for (const callback of reminderCallbacks) {
        callback(reminder)
      }
    }
  }, intervalMs)
}

/**
 * 停止提醒检查
 */
export function stopReminderCheck(): void {
  if (checkInterval) {
    clearInterval(checkInterval)
    checkInterval = null
  }
}

/**
 * 从自然语言创建提醒
 */
export function createReminderFromText(
  userId: string,
  text: string,
  db?: Database.Database,
): Reminder | null {
  // 解析时间
  const parsed = parseTime(text)
  if (!parsed) return null

  // 提取标题（去掉时间部分）
  let title = text

  // 常见模式匹配
  const patterns = [
    /提醒我(.+)/,
    /记得(.+)/,
    /别忘了(.+)/,
    /(\d+分钟后)提醒我(.+)/,
    /(\d+小时后)提醒我(.+)/,
    /(明天|后天|下周)\s*(\d+点)?\s*提醒我(.+)/,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      if (match[match.length - 1]) {
        title = match[match.length - 1].trim()
      }
      break
    }
  }

  return createReminder(
    {
      userId,
      title,
      remindAt: parsed.time,
    },
    db,
  )
}

// 辅助函数
function calculateNextTime(current: Date, repeat: ReminderRepeat): Date {
  const next = new Date(current)
  switch (repeat) {
    case 'daily':
      next.setDate(next.getDate() + 1)
      break
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + 1)
      break
  }
  return next
}

function rowToReminder(row: any): Reminder {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content || undefined,
    remindAt: row.remind_at,
    repeat: row.repeat as ReminderRepeat,
    status: row.status as ReminderStatus,
    createdAt: row.created_at,
  }
}
