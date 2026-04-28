/**
 * 数据库表结构定义和初始化
 */

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export interface AssistantDbConfig {
  /** 数据库文件路径 */
  path?: string;
  /** 是否在内存中（测试用） */
  inMemory?: boolean;
}

let db: Database.Database | null = null;

/**
 * 获取数据库实例
 */
export function getDb(config: AssistantDbConfig = {}): Database.Database {
  if (db) return db;

  if (config.inMemory) {
    db = new Database(':memory:');
  } else {
    const dbPath = config.path || path.join(process.env.HOME || '', '.colobot', 'assistant.db');
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    db = new Database(dbPath);
  }

  initTables(db);
  return db;
}

/**
 * 关闭数据库连接
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * 初始化所有表
 */
function initTables(db: Database.Database): void {
  // 待办清单
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_todos (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT DEFAULT 'medium',
      status TEXT DEFAULT 'pending',
      due_date TEXT,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_todos_user ON assistant_todos(user_id);
    CREATE INDEX IF NOT EXISTS idx_todos_status ON assistant_todos(status);
    CREATE INDEX IF NOT EXISTS idx_todos_due ON assistant_todos(due_date);
  `);

  // 提醒
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_reminders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      remind_at TEXT NOT NULL,
      repeat TEXT DEFAULT 'none',
      status TEXT DEFAULT 'pending',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_reminders_user ON assistant_reminders(user_id);
    CREATE INDEX IF NOT EXISTS idx_reminders_at ON assistant_reminders(remind_at);
  `);

  // 日程
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_events (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      start_at TEXT NOT NULL,
      end_at TEXT,
      location TEXT,
      repeat TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_events_user ON assistant_events(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_start ON assistant_events(start_at);
  `);

  // 笔记
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_notes_user ON assistant_notes(user_id);
  `);

  // 习惯追踪
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_habits (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      frequency TEXT DEFAULT 'daily',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS assistant_habit_logs (
      id TEXT PRIMARY KEY,
      habit_id TEXT NOT NULL,
      logged_at TEXT DEFAULT (datetime('now')),
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_habits_user ON assistant_habits(user_id);
    CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON assistant_habit_logs(habit_id);
  `);

  // 情绪日记
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_moods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mood TEXT NOT NULL,
      score INTEGER,
      note TEXT,
      logged_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_moods_user ON assistant_moods(user_id);
  `);

  // 财务记录
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_finances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      note TEXT,
      logged_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_finances_user ON assistant_finances(user_id);
  `);

  // 学习进度
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_courses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      total_hours REAL DEFAULT 0,
      completed_hours REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_courses_user ON assistant_courses(user_id);
  `);

  // 目标
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      target_date TEXT,
      progress REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_goals_user ON assistant_goals(user_id);
  `);

  // 阅读清单
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_readings (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      type TEXT,
      status TEXT DEFAULT 'pending',
      progress REAL DEFAULT 0,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_readings_user ON assistant_readings(user_id);
  `);

  // 人脉
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      organization TEXT,
      role TEXT,
      email TEXT,
      phone TEXT,
      tags TEXT,
      last_contact TEXT,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_contacts_user ON assistant_contacts(user_id);
  `);

  // 项目
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'active',
      progress REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_projects_user ON assistant_projects(user_id);
  `);

  // 灵感笔记
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_inspirations (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_inspirations_user ON assistant_inspirations(user_id);
  `);

  // 时间追踪
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_time_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      activity TEXT NOT NULL,
      category TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_minutes INTEGER,
      note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_time_logs_user ON assistant_time_logs(user_id);
  `);

  // 密码
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_passwords (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      username TEXT,
      encrypted_password TEXT NOT NULL,
      url TEXT,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_passwords_user ON assistant_passwords(user_id);
  `);

  // 健康
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_health (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      unit TEXT NOT NULL,
      note TEXT,
      logged_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_health_user ON assistant_health(user_id);
  `);

  // 收藏
  db.exec(`
    CREATE TABLE IF NOT EXISTS assistant_bookmarks (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT NOT NULL,
      summary TEXT,
      tags TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON assistant_bookmarks(user_id);
  `);
}

// 生成唯一 ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
