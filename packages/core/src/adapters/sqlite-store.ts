/**
 * SQLite 存储适配器 - PostgreSQL 降级方案
 *
 * 当 PostgreSQL 不可用时，自动降级到 SQLite
 * 注意：不支持向量检索，记忆搜索降级为文本匹配
 */

import type { LLMMessage } from '@colobot/types';
import type { MemoryStore } from '../runtime/types.js';
import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

export interface SQLiteStoreConfig {
  /** 数据库文件路径 */
  path?: string;
  /** 表名前缀 */
  tablePrefix?: string;
}

/**
 * SQLite 存储实现
 *
 * 适合开发测试环境，无需 PostgreSQL 服务
 */
export class SQLiteStore implements MemoryStore {
  private db: Database.Database;
  private tablePrefix: string;
  private initialized: boolean = false;

  constructor(config: SQLiteStoreConfig = {}) {
    const dbPath = resolve(config.path || './data/colobot.db');
    this.tablePrefix = config.tablePrefix || 'colobot';

    // 确保目录存在
    const dbDir = dirname(dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }

    this.db = new Database(dbPath);
    // 启用 WAL 模式提高性能
    this.db.pragma('journal_mode = WAL');
  }

  /**
   * 确保表存在
   */
  private ensureTable(): void {
    if (this.initialized) return;

    const tableName = `${this.tablePrefix}_session_messages`;

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        session_key TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_agent_session
      ON ${tableName} (agent_id, session_key)
    `);

    // 记忆表（用于文本搜索）
    const memoryTable = `${this.tablePrefix}_memory`;
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS ${memoryTable} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_id TEXT NOT NULL,
        content TEXT NOT NULL,
        metadata TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_${memoryTable}_agent
      ON ${memoryTable} (agent_id)
    `);

    this.initialized = true;
  }

  async append(
    agentId: string,
    sessionKey: string,
    role: string,
    content: unknown
  ): Promise<void> {
    this.ensureTable();

    const tableName = `${this.tablePrefix}_session_messages`;
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

    const stmt = this.db.prepare(
      `INSERT INTO ${tableName} (agent_id, session_key, role, content) VALUES (?, ?, ?, ?)`
    );
    stmt.run(agentId, sessionKey, role, contentStr);
  }

  async getHistory(agentId: string, sessionKey: string): Promise<LLMMessage[]> {
    this.ensureTable();

    const tableName = `${this.tablePrefix}_session_messages`;

    const stmt = this.db.prepare(
      `SELECT role, content FROM ${tableName}
       WHERE agent_id = ? AND session_key = ?
       ORDER BY created_at ASC`
    );
    const rows = stmt.all(agentId, sessionKey) as Array<{ role: string; content: string }>;

    return rows.map(row => ({
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
    }));
  }

  async clear(agentId: string, sessionKey: string): Promise<void> {
    this.ensureTable();

    const tableName = `${this.tablePrefix}_session_messages`;

    const stmt = this.db.prepare(
      `DELETE FROM ${tableName} WHERE agent_id = ? AND session_key = ?`
    );
    stmt.run(agentId, sessionKey);
  }

  /**
   * 添加记忆（文本搜索）
   */
  async addMemory(agentId: string, content: string, metadata?: Record<string, unknown>): Promise<void> {
    this.ensureTable();

    const tableName = `${this.tablePrefix}_memory`;
    const metadataStr = metadata ? JSON.stringify(metadata) : null;

    const stmt = this.db.prepare(
      `INSERT INTO ${tableName} (agent_id, content, metadata) VALUES (?, ?, ?)`
    );
    stmt.run(agentId, content, metadataStr);
  }

  /**
   * 搜索记忆（文本匹配，降级方案）
   */
  async searchMemory(agentId: string, query: string, limit: number = 10): Promise<Array<{
    content: string;
    metadata?: Record<string, unknown>;
    score: number;
  }>> {
    this.ensureTable();

    const tableName = `${this.tablePrefix}_memory`;

    // 使用 LIKE 进行简单的文本匹配
    const stmt = this.db.prepare(
      `SELECT content, metadata FROM ${tableName}
       WHERE agent_id = ? AND content LIKE ?
       ORDER BY created_at DESC
       LIMIT ?`
    );
    const rows = stmt.all(agentId, `%${query}%`, limit) as Array<{
      content: string;
      metadata: string | null;
    }>;

    return rows.map(row => ({
      content: row.content,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      score: 1.0, // SQLite 无法计算相似度分数
    }));
  }

  /**
   * 清理旧消息
   */
  async cleanupOldMessages(daysToKeep: number = 30): Promise<void> {
    this.ensureTable();

    const tableName = `${this.tablePrefix}_session_messages`;

    const stmt = this.db.prepare(
      `DELETE FROM ${tableName} WHERE created_at < datetime('now', '-${daysToKeep} days')`
    );
    stmt.run();
  }

  /**
   * 关闭数据库连接
   */
  close(): void {
    this.db.close();
  }
}

/**
 * 自动选择存储适配器
 *
 * 优先尝试 PostgreSQL，失败则降级到 SQLite
 */
export async function createAutoStore(config: {
  /** PostgreSQL 配置 */
  postgres?: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
  };
  /** SQLite 配置 */
  sqlite?: {
    path?: string;
  };
  /** 表名前缀 */
  tablePrefix?: string;
}): Promise<{ store: MemoryStore; type: 'postgres' | 'sqlite' }> {
  const { DatabaseStore } = await import('./database-store.js');

  try {
    // 尝试 PostgreSQL
    const store = new DatabaseStore({
      ...config.postgres,
      tablePrefix: config.tablePrefix,
    });
    // 测试连接
    await store.getHistory('test', 'test');
    return { store, type: 'postgres' };
  } catch (error) {
    console.warn('PostgreSQL connection failed, falling back to SQLite:', error);
    // 降级到 SQLite
    const store = new SQLiteStore({
      ...config.sqlite,
      tablePrefix: config.tablePrefix,
    });
    return { store, type: 'sqlite' };
  }
}
