/**
 * 目标管理模块
 */

import Database from 'better-sqlite3';
import { getDb, generateId } from '../db/schema.js';

export type GoalStatus = 'active' | 'achieved' | 'abandoned';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description?: string;
  targetDate?: string;
  progress: number; // 0-100
  status: GoalStatus;
  createdAt: string;
}

/**
 * 创建目标
 */
export function createGoal(userId: string, title: string, description?: string, targetDate?: string, db?: Database.Database): Goal {
  const database = db || getDb();
  const id = generateId();
  const now = new Date().toISOString();

  database.prepare(`
    INSERT INTO assistant_goals (id, user_id, title, description, target_date, progress, status, created_at)
    VALUES (?, ?, ?, ?, ?, 0, 'active', ?)
  `).run(id, userId, title, description || null, targetDate || null, now);

  return { id, userId, title, description, targetDate, progress: 0, status: 'active', createdAt: now };
}

/**
 * 更新目标进度
 */
export function updateGoalProgress(id: string, userId: string, progress: number, db?: Database.Database): Goal | null {
  const database = db || getDb();
  const goal = getGoal(id, userId, database);
  if (!goal) return null;

  const status = progress >= 100 ? 'achieved' : goal.status;

  database.prepare(`UPDATE assistant_goals SET progress = ?, status = ? WHERE id = ? AND user_id = ?`).run(progress, status, id, userId);

  return getGoal(id, userId, database);
}

/**
 * 获取目标
 */
export function getGoal(id: string, userId: string, db?: Database.Database): Goal | null {
  const database = db || getDb();
  const row = database.prepare(`SELECT * FROM assistant_goals WHERE id = ? AND user_id = ?`).get(id, userId) as any;
  return row ? rowToGoal(row) : null;
}

/**
 * 列出目标
 */
export function listGoals(userId: string, status?: GoalStatus, db?: Database.Database): Goal[] {
  const database = db || getDb();
  let sql = `SELECT * FROM assistant_goals WHERE user_id = ?`;
  const values: any[] = [userId];

  if (status) {
    sql += ` AND status = ?`;
    values.push(status);
  }

  sql += ` ORDER BY target_date ASC, created_at DESC`;
  const rows = database.prepare(sql).all(...values) as any[];
  return rows.map(rowToGoal);
}

/**
 * 删除目标
 */
export function deleteGoal(id: string, userId: string, db?: Database.Database): boolean {
  const database = db || getDb();
  return database.prepare(`DELETE FROM assistant_goals WHERE id = ? AND user_id = ?`).run(id, userId).changes > 0;
}

function rowToGoal(row: any): Goal {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || undefined,
    targetDate: row.target_date || undefined,
    progress: row.progress,
    status: row.status as GoalStatus,
    createdAt: row.created_at,
  };
}