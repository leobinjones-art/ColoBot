/**
 * 数据库连接
 */

import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'colobot',
  user: process.env.DB_USER || 'colonies',
  password: process.env.DB_PASSWORD,
});

export async function query<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  try {
    const result = await pool.query(sql, params);
    return result.rows as T[];
  } catch (e) {
    console.error('[DB] Query error:', e);
    throw e;
  }
}

export async function queryOne<T = unknown>(
  sql: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
