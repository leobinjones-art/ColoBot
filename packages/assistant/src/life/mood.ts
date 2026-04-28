/**
 * 情绪日记模块
 */

import Database from 'better-sqlite3';
import { getDb, generateId } from '../db/schema.js';

export type MoodType = 'happy' | 'sad' | 'neutral' | 'angry' | 'anxious' | 'excited' | 'calm';

export interface MoodEntry {
  id: string;
  userId: string;
  mood: MoodType;
  score: number; // 1-10
  note?: string;
  loggedAt: string;
}

const MOOD_SCORES: Record<MoodType, number> = {
  happy: 8,
  excited: 9,
  calm: 7,
  neutral: 5,
  sad: 3,
  angry: 2,
  anxious: 4,
};

/**
 * 记录心情
 */
export function logMood(userId: string, mood: MoodType, score?: number, note?: string, db?: Database.Database): MoodEntry {
  const database = db || getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const finalScore = score ?? MOOD_SCORES[mood];

  database.prepare(`
    INSERT INTO assistant_moods (id, user_id, mood, score, note, logged_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, userId, mood, finalScore, note || null, now);

  return { id, userId, mood, score: finalScore, note, loggedAt: now };
}

/**
 * 获取心情记录
 */
export function getMoodEntries(userId: string, limit = 30, db?: Database.Database): MoodEntry[] {
  const database = db || getDb();
  const rows = database.prepare(`
    SELECT * FROM assistant_moods WHERE user_id = ? ORDER BY logged_at DESC LIMIT ?
  `).all(userId, limit) as any[];
  return rows.map(rowToMood);
}

/**
 * 获取某天的心情
 */
export function getDayMood(userId: string, date: Date | string, db?: Database.Database): MoodEntry | null {
  const database = db || getDb();
  const dateStr = typeof date === 'string' ? date : date.toISOString().split('T')[0];
  const row = database.prepare(`
    SELECT * FROM assistant_moods WHERE user_id = ? AND date(logged_at) = date(?) ORDER BY logged_at DESC LIMIT 1
  `).get(userId, dateStr) as any;
  return row ? rowToMood(row) : null;
}

/**
 * 获取心情统计
 */
export function getMoodStats(userId: string, days = 30, db?: Database.Database): {
  averageScore: number;
  moodCounts: Record<MoodType, number>;
  trend: 'up' | 'down' | 'stable';
} {
  const database = db || getDb();
  const rows = database.prepare(`
    SELECT mood, score FROM assistant_moods
    WHERE user_id = ? AND logged_at >= datetime('now', '-' || ? || ' days')
  `).all(userId, days) as any[];

  const moodCounts: Record<MoodType, number> = {
    happy: 0, sad: 0, neutral: 0, angry: 0, anxious: 0, excited: 0, calm: 0,
  };

  let totalScore = 0;
  for (const row of rows) {
    moodCounts[row.mood as MoodType]++;
    totalScore += row.score;
  }

  // 计算趋势（最近7天 vs 之前7天）
  const recentRows = database.prepare(`
    SELECT AVG(score) as avg FROM assistant_moods
    WHERE user_id = ? AND logged_at >= datetime('now', '-7 days')
  `).get(userId) as any;

  const previousRows = database.prepare(`
    SELECT AVG(score) as avg FROM assistant_moods
    WHERE user_id = ? AND logged_at >= datetime('now', '-14 days') AND logged_at < datetime('now', '-7 days')
  `).get(userId) as any;

  const recentAvg = recentRows?.avg || 0;
  const previousAvg = previousRows?.avg || 0;

  let trend: 'up' | 'down' | 'stable' = 'stable';
  if (recentAvg - previousAvg > 0.5) trend = 'up';
  else if (previousAvg - recentAvg > 0.5) trend = 'down';

  return {
    averageScore: rows.length > 0 ? totalScore / rows.length : 0,
    moodCounts,
    trend,
  };
}

function rowToMood(row: any): MoodEntry {
  return {
    id: row.id,
    userId: row.user_id,
    mood: row.mood as MoodType,
    score: row.score,
    note: row.note || undefined,
    loggedAt: row.logged_at,
  };
}