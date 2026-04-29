/**
 * 项目管理模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'

export interface Project {
  id: string
  userId: string
  name: string
  description?: string
  status: ProjectStatus
  progress: number // 0-100
  createdAt: string
}

/**
 * 创建项目
 */
export function createProject(
  userId: string,
  name: string,
  description?: string,
  db?: Database.Database,
): Project {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  database
    .prepare(
      `
    INSERT INTO assistant_projects (id, user_id, name, description, status, progress, created_at)
    VALUES (?, ?, ?, ?, 'active', 0, ?)
  `,
    )
    .run(id, userId, name, description || null, now)

  return { id, userId, name, description, status: 'active', progress: 0, createdAt: now }
}

/**
 * 获取项目
 */
export function getProject(id: string, userId: string, db?: Database.Database): Project | null {
  const database = db || getDb()
  const row = database
    .prepare(`SELECT * FROM assistant_projects WHERE id = ? AND user_id = ?`)
    .get(id, userId) as any
  return row ? rowToProject(row) : null
}

/**
 * 更新项目
 */
export function updateProject(
  id: string,
  userId: string,
  updates: Partial<Pick<Project, 'name' | 'description' | 'status' | 'progress'>>,
  db?: Database.Database,
): Project | null {
  const database = db || getDb()
  const project = getProject(id, userId, database)
  if (!project) return null

  const fields: string[] = []
  const values: any[] = []

  if (updates.name !== undefined) {
    fields.push('name = ?')
    values.push(updates.name)
  }
  if (updates.description !== undefined) {
    fields.push('description = ?')
    values.push(updates.description)
  }
  if (updates.status !== undefined) {
    fields.push('status = ?')
    values.push(updates.status)
  }
  if (updates.progress !== undefined) {
    fields.push('progress = ?')
    values.push(updates.progress)
  }

  if (fields.length === 0) return project

  values.push(id, userId)
  database
    .prepare(`UPDATE assistant_projects SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...values)

  return getProject(id, userId, database)
}

/**
 * 列出项目
 */
export function listProjects(
  userId: string,
  status?: ProjectStatus,
  db?: Database.Database,
): Project[] {
  const database = db || getDb()
  let sql = `SELECT * FROM assistant_projects WHERE user_id = ?`
  const values: any[] = [userId]

  if (status) {
    sql += ` AND status = ?`
    values.push(status)
  }

  sql += ` ORDER BY created_at DESC`
  const rows = database.prepare(sql).all(...values) as any[]
  return rows.map(rowToProject)
}

/**
 * 删除项目
 */
export function deleteProject(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  return (
    database.prepare(`DELETE FROM assistant_projects WHERE id = ? AND user_id = ?`).run(id, userId)
      .changes > 0
  )
}

function rowToProject(row: any): Project {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    description: row.description || undefined,
    status: row.status as ProjectStatus,
    progress: row.progress,
    createdAt: row.created_at,
  }
}
