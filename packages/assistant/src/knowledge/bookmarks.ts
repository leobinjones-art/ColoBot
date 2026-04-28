/**
 * 网页收藏模块
 */

import Database from 'better-sqlite3';
import { getDb, generateId } from '../db/schema.js';

export interface Bookmark {
  id: string;
  userId: string;
  url: string;
  title: string;
  summary?: string;
  tags: string[];
  createdAt: string;
}

export interface CreateBookmarkInput {
  userId: string;
  url: string;
  title: string;
  summary?: string;
  tags?: string[];
}

/**
 * 创建收藏
 */
export function createBookmark(input: CreateBookmarkInput, db?: Database.Database): Bookmark {
  const database = db || getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO assistant_bookmarks (id, user_id, url, title, summary, tags, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, input.userId, input.url, input.title, input.summary || null, JSON.stringify(input.tags || []), now);

  return { id, ...input, tags: input.tags || [], createdAt: now };
}

/**
 * 获取收藏
 */
export function getBookmark(id: string, userId: string, db?: Database.Database): Bookmark | null {
  const database = db || getDb();
  const stmt = database.prepare(`SELECT * FROM assistant_bookmarks WHERE id = ? AND user_id = ?`);
  const row = stmt.get(id, userId) as any;
  return row ? rowToBookmark(row) : null;
}

/**
 * 删除收藏
 */
export function deleteBookmark(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb();
  const stmt = database.prepare(`DELETE FROM assistant_bookmarks WHERE id = ? AND user_id = ?`);
  return stmt.run(id, userId).changes > 0;
}

/**
 * 列出收藏
 */
export function listBookmarks(userId: string, tag?: string, db?: Database.Database): Bookmark[] {
  const database = db || getDb();
  let sql = `SELECT * FROM assistant_bookmarks WHERE user_id = ?`;
  const values: any[] = [userId];

  if (tag) {
    sql += ` AND tags LIKE ?`;
    values.push(`%"${tag}"%`);
  }

  sql += ` ORDER BY created_at DESC`;

  const rows = database.prepare(sql).all(...values) as any[];
  return rows.map(rowToBookmark);
}

/**
 * 搜索收藏
 */
export function searchBookmarks(userId: string, query: string, db?: Database.Database): Bookmark[] {
  const database = db || getDb();
  const stmt = database.prepare(`
    SELECT * FROM assistant_bookmarks
    WHERE user_id = ? AND (title LIKE ? OR summary LIKE ? OR url LIKE ?)
    ORDER BY created_at DESC
  `);
  const pattern = `%${query}%`;
  const rows = stmt.all(userId, pattern, pattern, pattern) as any[];
  return rows.map(rowToBookmark);
}

function rowToBookmark(row: any): Bookmark {
  return {
    id: row.id,
    userId: row.user_id,
    url: row.url,
    title: row.title,
    summary: row.summary || undefined,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
  };
}