/**
 * 待办清单模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'

export type TodoPriority = 'high' | 'medium' | 'low'
export type TodoStatus = 'pending' | 'doing' | 'done' | 'cancelled'

export interface Todo {
  id: string
  userId: string
  title: string
  description?: string
  priority: TodoPriority
  status: TodoStatus
  dueDate?: string
  tags: string[]
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface CreateTodoInput {
  userId: string
  title: string
  description?: string
  priority?: TodoPriority
  dueDate?: string
  tags?: string[]
}

export interface UpdateTodoInput {
  title?: string
  description?: string
  priority?: TodoPriority
  status?: TodoStatus
  dueDate?: string
  tags?: string[]
}

export interface TodoFilter {
  status?: TodoStatus
  priority?: TodoPriority
  dueBefore?: string
  dueAfter?: string
  tags?: string[]
}

/**
 * 创建待办
 */
export function createTodo(input: CreateTodoInput, db?: Database.Database): Todo {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  const stmt = database.prepare(`
    INSERT INTO assistant_todos (id, user_id, title, description, priority, status, due_date, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    input.userId,
    input.title,
    input.description || null,
    input.priority || 'medium',
    input.dueDate || null,
    JSON.stringify(input.tags || []),
    now,
    now,
  )

  return {
    id,
    userId: input.userId,
    title: input.title,
    description: input.description,
    priority: input.priority || 'medium',
    status: 'pending',
    dueDate: input.dueDate,
    tags: input.tags || [],
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * 获取待办
 */
export function getTodo(id: string, userId: string, db?: Database.Database): Todo | null {
  const database = db || getDb()
  const stmt = database.prepare(`
    SELECT * FROM assistant_todos WHERE id = ? AND user_id = ?
  `)
  const row = stmt.get(id, userId) as any
  return row ? rowToTodo(row) : null
}

/**
 * 更新待办
 */
export function updateTodo(
  id: string,
  userId: string,
  input: UpdateTodoInput,
  db?: Database.Database,
): Todo | null {
  const database = db || getDb()
  const todo = getTodo(id, userId, database)
  if (!todo) return null

  const now = new Date().toISOString()
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
  if (input.priority !== undefined) {
    updates.push('priority = ?')
    values.push(input.priority)
  }
  if (input.status !== undefined) {
    updates.push('status = ?')
    values.push(input.status)
    if (input.status === 'done') {
      updates.push('completed_at = ?')
      values.push(now)
    }
  }
  if (input.dueDate !== undefined) {
    updates.push('due_date = ?')
    values.push(input.dueDate)
  }
  if (input.tags !== undefined) {
    updates.push('tags = ?')
    values.push(JSON.stringify(input.tags))
  }

  if (updates.length === 0) return todo

  updates.push('updated_at = ?')
  values.push(now)
  values.push(id, userId)

  const stmt = database.prepare(`
    UPDATE assistant_todos SET ${updates.join(', ')} WHERE id = ? AND user_id = ?
  `)
  stmt.run(...values)

  return getTodo(id, userId, database)
}

/**
 * 删除待办
 */
export function deleteTodo(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  const stmt = database.prepare(`DELETE FROM assistant_todos WHERE id = ? AND user_id = ?`)
  const result = stmt.run(id, userId)
  return result.changes > 0
}

/**
 * 列出待办
 */
export function listTodos(userId: string, filter?: TodoFilter, db?: Database.Database): Todo[] {
  const database = db || getDb()
  let sql = `SELECT * FROM assistant_todos WHERE user_id = ?`
  const values: any[] = [userId]

  if (filter?.status) {
    sql += ` AND status = ?`
    values.push(filter.status)
  }
  if (filter?.priority) {
    sql += ` AND priority = ?`
    values.push(filter.priority)
  }
  if (filter?.dueBefore) {
    sql += ` AND due_date <= ?`
    values.push(filter.dueBefore)
  }
  if (filter?.dueAfter) {
    sql += ` AND due_date >= ?`
    values.push(filter.dueAfter)
  }

  sql += ` ORDER BY priority DESC, due_date ASC, created_at DESC`

  const stmt = database.prepare(sql)
  const rows = stmt.all(...values) as any[]
  return rows.map(rowToTodo)
}

/**
 * 获取今日待办
 */
export function getTodayTodos(userId: string, db?: Database.Database): Todo[] {
  const today = new Date().toISOString().split('T')[0]
  const database = db || getDb()
  const stmt = database.prepare(`
    SELECT * FROM assistant_todos
    WHERE user_id = ? AND status IN ('pending', 'doing')
    AND (due_date IS NULL OR date(due_date) <= date(?))
    ORDER BY priority DESC, due_date ASC
  `)
  const rows = stmt.all(userId, today) as any[]
  return rows.map(rowToTodo)
}

/**
 * 完成待办
 */
export function completeTodo(id: string, userId: string, db?: Database.Database): Todo | null {
  return updateTodo(id, userId, { status: 'done' }, db)
}

/**
 * 行转对象
 */
function rowToTodo(row: any): Todo {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || undefined,
    priority: row.priority as TodoPriority,
    status: row.status as TodoStatus,
    dueDate: row.due_date || undefined,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at || undefined,
  }
}
