/**
 * 数据库存储适配器 - PostgreSQL 持久化
 */

import type { LLMMessage } from '@colobot/types';
import type { MemoryStore } from '../runtime/types.js';
import { initDb, query } from '../memory/db.js';

export interface DatabaseStoreConfig {
  /** 数据库主机 */
  host?: string;
  /** 数据库端口 */
  port?: number;
  /** 数据库名 */
  database?: string;
  /** 用户名 */
  user?: string;
  /** 密码 */
  password?: string;
  /** 表名前缀 */
  tablePrefix?: string;
}

/**
 * 数据库存储实现
 *
 * 使用 PostgreSQL 存储会话历史，支持持久化
 */
export class DatabaseStore implements MemoryStore {
  private tablePrefix: string;
  private initialized: boolean = false;

  constructor(config: DatabaseStoreConfig = {}) {
    this.tablePrefix = config.tablePrefix || 'colobot';

    // 初始化数据库连接
    initDb({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
    });
  }

  /**
   * 确保表存在
   */
  private async ensureTable(): Promise<void> {
    if (this.initialized) return;

    const tableName = `${this.tablePrefix}_session_messages`;

    await query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        agent_id VARCHAR(255) NOT NULL,
        session_key VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        content TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await query(`
      CREATE INDEX IF NOT EXISTS idx_${tableName}_agent_session
      ON ${tableName} (agent_id, session_key)
    `);

    this.initialized = true;
  }

  async append(
    agentId: string,
    sessionKey: string,
    role: string,
    content: unknown
  ): Promise<void> {
    await this.ensureTable();

    const tableName = `${this.tablePrefix}_session_messages`;
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);

    await query(
      `INSERT INTO ${tableName} (agent_id, session_key, role, content)
       VALUES ($1, $2, $3, $4)`,
      [agentId, sessionKey, role, contentStr]
    );
  }

  async getHistory(agentId: string, sessionKey: string): Promise<LLMMessage[]> {
    await this.ensureTable();

    const tableName = `${this.tablePrefix}_session_messages`;

    const rows = await query<{ role: string; content: string }>(
      `SELECT role, content FROM ${tableName}
       WHERE agent_id = $1 AND session_key = $2
       ORDER BY created_at ASC`,
      [agentId, sessionKey]
    );

    return rows.map(row => ({
      role: row.role as 'user' | 'assistant' | 'system',
      content: row.content,
    }));
  }

  async clear(agentId: string, sessionKey: string): Promise<void> {
    await this.ensureTable();

    const tableName = `${this.tablePrefix}_session_messages`;

    await query(
      `DELETE FROM ${tableName} WHERE agent_id = $1 AND session_key = $2`,
      [agentId, sessionKey]
    );
  }

  /**
   * 清理旧消息（可选，用于维护）
   */
  async cleanupOldMessages(daysToKeep: number = 30): Promise<void> {
    await this.ensureTable();

    const tableName = `${this.tablePrefix}_session_messages`;

    await query(
      `DELETE FROM ${tableName} WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`
    );
  }
}
