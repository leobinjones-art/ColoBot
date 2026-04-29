/**
 * 人脉管理模块
 */

import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'

export interface Contact {
  id: string
  userId: string
  name: string
  organization?: string
  role?: string
  email?: string
  phone?: string
  tags: string[]
  lastContact?: string
  note?: string
  createdAt: string
}

/**
 * 创建联系人
 */
export function createContact(
  userId: string,
  name: string,
  options: Partial<Contact> = {},
  db?: Database.Database,
): Contact {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()

  database
    .prepare(
      `
    INSERT INTO assistant_contacts (id, user_id, name, organization, role, email, phone, tags, last_contact, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      id,
      userId,
      name,
      options.organization || null,
      options.role || null,
      options.email || null,
      options.phone || null,
      JSON.stringify(options.tags || []),
      options.lastContact || null,
      options.note || null,
      now,
    )

  return { id, userId, name, tags: [], createdAt: now, ...options }
}

/**
 * 获取联系人
 */
export function getContact(id: string, userId: string, db?: Database.Database): Contact | null {
  const database = db || getDb()
  const row = database
    .prepare(`SELECT * FROM assistant_contacts WHERE id = ? AND user_id = ?`)
    .get(id, userId) as any
  return row ? rowToContact(row) : null
}

/**
 * 更新联系人
 */
export function updateContact(
  id: string,
  userId: string,
  updates: Partial<Contact>,
  db?: Database.Database,
): Contact | null {
  const database = db || getDb()
  const contact = getContact(id, userId, database)
  if (!contact) return null

  const fields: string[] = []
  const values: any[] = []

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'tags') {
      fields.push('tags = ?')
      values.push(JSON.stringify(value))
    } else if (key !== 'id' && key !== 'userId' && key !== 'createdAt') {
      fields.push(`${key} = ?`)
      values.push(value)
    }
  }

  if (fields.length === 0) return contact

  values.push(id, userId)
  database
    .prepare(`UPDATE assistant_contacts SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...values)

  return getContact(id, userId, database)
}

/**
 * 列出联系人
 */
export function listContacts(userId: string, tag?: string, db?: Database.Database): Contact[] {
  const database = db || getDb()
  let sql = `SELECT * FROM assistant_contacts WHERE user_id = ?`
  const values: any[] = [userId]

  if (tag) {
    sql += ` AND tags LIKE ?`
    values.push(`%"${tag}"%`)
  }

  sql += ` ORDER BY name ASC`
  const rows = database.prepare(sql).all(...values) as any[]
  return rows.map(rowToContact)
}

/**
 * 搜索联系人
 */
export function searchContacts(userId: string, query: string, db?: Database.Database): Contact[] {
  const database = db || getDb()
  const rows = database
    .prepare(
      `
    SELECT * FROM assistant_contacts WHERE user_id = ? AND (name LIKE ? OR organization LIKE ? OR note LIKE ?)
    ORDER BY name ASC
  `,
    )
    .all(userId, `%${query}%`, `%${query}%`, `%${query}%`) as any[]
  return rows.map(rowToContact)
}

/**
 * 删除联系人
 */
export function deleteContact(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  return (
    database.prepare(`DELETE FROM assistant_contacts WHERE id = ? AND user_id = ?`).run(id, userId)
      .changes > 0
  )
}

/**
 * 记录互动
 */
export function recordInteraction(
  id: string,
  userId: string,
  db?: Database.Database,
): Contact | null {
  return updateContact(id, userId, { lastContact: new Date().toISOString() }, db)
}

function rowToContact(row: any): Contact {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    organization: row.organization || undefined,
    role: row.role || undefined,
    email: row.email || undefined,
    phone: row.phone || undefined,
    tags: row.tags ? JSON.parse(row.tags) : [],
    lastContact: row.last_contact || undefined,
    note: row.note || undefined,
    createdAt: row.created_at,
  }
}
