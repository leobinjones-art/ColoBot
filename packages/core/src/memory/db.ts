/**
 * 数据库连接 - PostgreSQL + pgvector
 */

import pg from 'pg';

const { Pool } = pg;

export interface DbConfig {
  host?: string;
  port?: number;
  database?: string;
  user?: string;
  password?: string;
}

let pool: pg.Pool | null = null;

/**
 * 初始化数据库连接
 */
export function initDb(config: DbConfig = {}): void {
  if (pool) return;

  pool = new Pool({
    host: config.host || process.env.DB_HOST || 'localhost',
    port: config.port || parseInt(process.env.DB_PORT || '5432'),
    database: config.database || process.env.DB_NAME || 'colobot',
    user: config.user || process.env.DB_USER || 'colonies',
    password: config.password || process.env.DB_PASSWORD,
  });
}

/**
 * 执行查询
 */
export async function query<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (!pool) initDb();

  try {
    const result = await pool!.query(sql, params);
    return result.rows as T[];
  } catch (e) {
    console.error('[DB] Query error:', e);
    throw e;
  }
}

/**
 * 查询单条
 */
export async function queryOne<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

/**
 * 关闭连接
 */
export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * 获取连接池
 */
export function getPool(): pg.Pool | null {
  return pool;
}
