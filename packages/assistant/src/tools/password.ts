/**
 * 密码管理模块
 */

import * as crypto from 'crypto'
import Database from 'better-sqlite3'
import { getDb, generateId } from '../db/schema.js'
import { PasswordRow } from '../db/types.js'

export interface PasswordEntry {
  id: string
  userId: string
  name: string
  username?: string
  url?: string
  note?: string
  createdAt: string
  updatedAt: string
}

// 加密密钥（应从配置获取）
let encryptionKey: string = process.env.COLOMIND_ENCRYPTION_KEY || ''

/**
 * 设置加密密钥
 */
export function setEncryptionKey(key: string): void {
  encryptionKey = key
}

/**
 * 获取加密密钥，未设置时抛出错误
 */
function requireEncryptionKey(): string {
  if (!encryptionKey) {
    throw new Error('Encryption key not configured. Set COLOMIND_ENCRYPTION_KEY env var or call setEncryptionKey().')
  }
  return encryptionKey
}

/**
 * 加密
 */
export function encrypt(text: string): string {
  const key = requireEncryptionKey()
  const iv = crypto.randomBytes(16)
  const derivedKey = crypto.scryptSync(key, 'salt', 32)
  const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

/**
 * 解密
 */
export function decrypt(encryptedText: string): string {
  const key = requireEncryptionKey()
  const [ivHex, encrypted] = encryptedText.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const derivedKey = crypto.scryptSync(key, 'salt', 32)
  const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv)
  let decrypted = decipher.update(encrypted, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

/**
 * 创建密码条目
 */
export function createPasswordEntry(
  userId: string,
  name: string,
  password: string,
  options: { username?: string; url?: string; note?: string } = {},
  db?: Database.Database,
): PasswordEntry {
  const database = db || getDb()
  const id = generateId()
  const now = new Date().toISOString()
  const encrypted = encrypt(password)

  database
    .prepare(
      `
    INSERT INTO assistant_passwords (id, user_id, name, username, encrypted_password, url, note, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
    )
    .run(
      id,
      userId,
      name,
      options.username || null,
      encrypted,
      options.url || null,
      options.note || null,
      now,
      now,
    )

  return { id, userId, name, ...options, createdAt: now, updatedAt: now }
}

/**
 * 获取密码条目（不含密码）
 */
export function getPasswordEntry(
  id: string,
  userId: string,
  db?: Database.Database,
): PasswordEntry | null {
  const database = db || getDb()
  const row = database
    .prepare(
      `SELECT id, user_id, name, username, url, note, created_at, updated_at FROM assistant_passwords WHERE id = ? AND user_id = ?`,
    )
    .get(id, userId) as PasswordRow
  return row ? rowToPasswordEntry(row) : null
}

/**
 * 获取密码
 */
export function getPassword(id: string, userId: string, db?: Database.Database): string | null {
  const database = db || getDb()
  const row = database
    .prepare(`SELECT encrypted_password FROM assistant_passwords WHERE id = ? AND user_id = ?`)
    .get(id, userId) as PasswordRow
  if (!row) return null
  return decrypt(row.encrypted_password)
}

/**
 * 列出密码条目（不含密码）
 */
export function listPasswordEntries(userId: string, db?: Database.Database): PasswordEntry[] {
  const database = db || getDb()
  const rows = database
    .prepare(
      `SELECT id, user_id, name, username, url, note, created_at, updated_at FROM assistant_passwords WHERE user_id = ? ORDER BY name ASC`,
    )
    .all(userId) as PasswordRow[]
  return rows.map(rowToPasswordEntry)
}

/**
 * 更新密码条目
 */
export function updatePasswordEntry(
  id: string,
  userId: string,
  updates: { name?: string; username?: string; password?: string; url?: string; note?: string },
  db?: Database.Database,
): PasswordEntry | null {
  const database = db || getDb()
  const entry = getPasswordEntry(id, userId, database)
  if (!entry) return null

  const now = new Date().toISOString()
  const fields: string[] = ['updated_at = ?']
  const values: (string | number | null)[] = [now]

  if (updates.name) {
    fields.push('name = ?')
    values.push(updates.name)
  }
  if (updates.username !== undefined) {
    fields.push('username = ?')
    values.push(updates.username)
  }
  if (updates.password) {
    fields.push('encrypted_password = ?')
    values.push(encrypt(updates.password))
  }
  if (updates.url !== undefined) {
    fields.push('url = ?')
    values.push(updates.url)
  }
  if (updates.note !== undefined) {
    fields.push('note = ?')
    values.push(updates.note)
  }

  values.push(id, userId)
  database
    .prepare(`UPDATE assistant_passwords SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`)
    .run(...values)

  return getPasswordEntry(id, userId, database)
}

/**
 * 删除密码条目
 */
export function deletePasswordEntry(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb()
  return (
    database.prepare(`DELETE FROM assistant_passwords WHERE id = ? AND user_id = ?`).run(id, userId)
      .changes > 0
  )
}

/**
 * 生成随机密码
 */
export function generatePassword(
  length = 16,
  options: { uppercase?: boolean; lowercase?: boolean; numbers?: boolean; symbols?: boolean } = {},
): string {
  const opts = { uppercase: true, lowercase: true, numbers: true, symbols: true, ...options }
  let chars = ''
  if (opts.lowercase) chars += 'abcdefghijklmnopqrstuvwxyz'
  if (opts.uppercase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (opts.numbers) chars += '0123456789'
  if (opts.symbols) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?'

  let password = ''
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return password
}

function rowToPasswordEntry(row: PasswordRow): PasswordEntry {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    username: row.username || undefined,
    url: row.url || undefined,
    note: row.note || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
