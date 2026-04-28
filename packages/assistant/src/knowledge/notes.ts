/**
 * 笔记模块
 */

import Database from 'better-sqlite3';
import { getDb, generateId } from '../db/schema.js';

export interface Note {
  id: string;
  userId: string;
  title: string;
  content?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  userId: string;
  title: string;
  content?: string;
  tags?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  tags?: string[];
}

/**
 * 创建笔记
 */
export function createNote(input: CreateNoteInput, db?: Database.Database): Note {
  const database = db || getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO assistant_notes (id, user_id, title, content, tags, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    id,
    input.userId,
    input.title,
    input.content || null,
    JSON.stringify(input.tags || []),
    now,
    now
  );

  return {
    id,
    userId: input.userId,
    title: input.title,
    content: input.content,
    tags: input.tags || [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * 获取笔记
 */
export function getNote(id: string, userId: string, db?: Database.Database): Note | null {
  const database = db || getDb();
  const stmt = database.prepare(`SELECT * FROM assistant_notes WHERE id = ? AND user_id = ?`);
  const row = stmt.get(id, userId) as any;
  return row ? rowToNote(row) : null;
}

/**
 * 更新笔记
 */
export function updateNote(id: string, userId: string, input: UpdateNoteInput, db?: Database.Database): Note | null {
  const database = db || getDb();
  const note = getNote(id, userId, database);
  if (!note) return null;

  const now = new Date().toISOString();
  const updates: string[] = [];
  const values: any[] = [];

  if (input.title !== undefined) {
    updates.push('title = ?');
    values.push(input.title);
  }
  if (input.content !== undefined) {
    updates.push('content = ?');
    values.push(input.content);
  }
  if (input.tags !== undefined) {
    updates.push('tags = ?');
    values.push(JSON.stringify(input.tags));
  }

  if (updates.length === 0) return note;

  updates.push('updated_at = ?');
  values.push(now, id, userId);

  const stmt = database.prepare(`UPDATE assistant_notes SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`);
  stmt.run(...values);

  return getNote(id, userId, database);
}

/**
 * 删除笔记
 */
export function deleteNote(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb();
  const stmt = database.prepare(`DELETE FROM assistant_notes WHERE id = ? AND user_id = ?`);
  const result = stmt.run(id, userId);
  return result.changes > 0;
}

/**
 * 列出笔记
 */
export function listNotes(userId: string, tag?: string, db?: Database.Database): Note[] {
  const database = db || getDb();
  let sql = `SELECT * FROM assistant_notes WHERE user_id = ?`;
  const values: any[] = [userId];

  if (tag) {
    sql += ` AND tags LIKE ?`;
    values.push(`%"${tag}"%`);
  }

  sql += ` ORDER BY updated_at DESC`;

  const stmt = database.prepare(sql);
  const rows = stmt.all(...values) as any[];
  return rows.map(rowToNote);
}

/**
 * 搜索笔记
 */
export function searchNotes(userId: string, query: string, db?: Database.Database): Note[] {
  const database = db || getDb();
  const stmt = database.prepare(`
    SELECT * FROM assistant_notes
    WHERE user_id = ? AND (title LIKE ? OR content LIKE ?)
    ORDER BY updated_at DESC
  `);
  const searchPattern = `%${query}%`;
  const rows = stmt.all(userId, searchPattern, searchPattern) as any[];
  return rows.map(rowToNote);
}

/**
 * 获取所有标签
 */
export function getAllTags(userId: string, db?: Database.Database): string[] {
  const database = db || getDb();
  const stmt = database.prepare(`SELECT tags FROM assistant_notes WHERE user_id = ?`);
  const rows = stmt.all(userId) as any[];

  const tagSet = new Set<string>();
  for (const row of rows) {
    const tags = JSON.parse(row.tags || '[]');
    for (const tag of tags) {
      tagSet.add(tag);
    }
  }

  return Array.from(tagSet);
}

function rowToNote(row: any): Note {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    content: row.content || undefined,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}