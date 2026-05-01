/**
 * 学习进度模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('Learning')

export interface Course {
  id: string
  userId: string
  name: string
  totalHours: number
  completedHours: number
  status: 'active' | 'paused' | 'completed'
  createdAt: string
}

/**
 * 创建课程
 */
export function createCourse(
  userId: string,
  name: string,
  totalHours = 0,
  db?: Database.Database,
): Course {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  database
    .prepare(
      `
    INSERT INTO assistant_courses (id, user_id, name, total_hours, completed_hours, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(id, userId, name, totalHours, 0, 'active', now)

  logger.info('Created course', { id, userId, name, totalHours })

  return { id, userId, name, totalHours, completedHours: 0, status: 'active', createdAt: now }
}

/**
 * 更新学习进度
 */
export function updateProgress(
  id: string,
  userId: string,
  hours: number,
  db?: Database.Database,
): Course | null {
  const database = db || getDb()
  const course = getCourse(id, userId, database)
  if (!course) {
    logger.warn('Course not found for update', { id, userId })
    return null
  }

  const newCompleted = course.completedHours + hours
  const status =
    course.totalHours > 0 && newCompleted >= course.totalHours ? 'completed' : course.status

  database
    .prepare(
      `
    UPDATE assistant_courses SET completed_hours = ?, status = ? WHERE id = ? AND user_id = ?
  `,
    )
    .run(newCompleted, status, id, userId)

  logger.info('Updated course progress', { id, userId, hours, totalCompleted: newCompleted, status })

  return getCourse(id, userId, database)
}

/**
 * 获取课程
 */
export function getCourse(id: string, userId: string, db?: Database.Database): Course | null {
  const database = db || getDb()
  const row = database
    .prepare(`SELECT * FROM assistant_courses WHERE id = ? AND user_id = ?`)
    .get(id, userId) as any
  return row ? rowToCourse(row) : null
}

/**
 * 列出课程
 */
export function listCourses(
  userId: string,
  status?: 'active' | 'paused' | 'completed',
  db?: Database.Database,
): Course[] {
  const database = db || getDb()
  let sql = `SELECT * FROM assistant_courses WHERE user_id = ?`
  const values: any[] = [userId]

  if (status) {
    sql += ` AND status = ?`
    values.push(status)
  }

  sql += ` ORDER BY created_at DESC`
  const rows = database.prepare(sql).all(...values) as any[]
  return rows.map(rowToCourse)
}

/**
 * 删除课程
 */
export function deleteCourse(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  const result = database.prepare(`DELETE FROM assistant_courses WHERE id = ? AND user_id = ?`).run(id, userId)
  const deleted = result.changes > 0
  if (deleted) {
    logger.info('Deleted course', { id, userId })
  } else {
    logger.warn('Course not found for deletion', { id, userId })
  }
  return deleted
}

function rowToCourse(row: any): Course {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    totalHours: row.total_hours,
    completedHours: row.completed_hours,
    status: row.status,
    createdAt: row.created_at,
  }
}
