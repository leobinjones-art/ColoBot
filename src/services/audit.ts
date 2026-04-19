/**
 * 审计日志服务
 */

import { query, queryOne } from '../memory/db.js';

export interface AuditEntry {
  actorType: string;
  actorId?: string;
  actorName?: string;
  action: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  detail?: Record<string, unknown>;
  ipAddress?: string;
  channel?: string;
  result?: 'success' | 'failure' | 'error' | 'blocked';
  errorMessage?: string;
}

export interface AuditListOptions {
  action?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export interface AuditLog {
  id: string;
  actor_type: string;
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  target_name: string | null;
  detail: Record<string, unknown>;
  ip_address: string | null;
  channel: string | null;
  result: string;
  error_message: string | null;
  created_at: Date;
}

/**
 * 查询审计日志
 */
export async function listAudit(options: AuditListOptions = {}): Promise<{ logs: AuditLog[]; total: number }> {
  const { action, actorId, from, to, limit = 50, offset = 0 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];
  let i = 1;

  if (action) {
    conditions.push(`action = $${i++}`);
    params.push(action);
  }
  if (actorId) {
    conditions.push(`actor_id = $${i++}`);
    params.push(actorId);
  }
  if (from) {
    conditions.push(`created_at >= $${i++}`);
    params.push(from);
  }
  if (to) {
    conditions.push(`created_at <= $${i++}`);
    params.push(to);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM audit_logs ${where}`,
    params
  );
  const total = parseInt(countRow?.count ?? '0');

  const rows = await query<AuditLog>(
    `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${i++} OFFSET $${i++}`,
    [...params, limit, offset]
  );

  return {
    logs: rows.map(r => ({
      ...r,
      detail: typeof r.detail === 'string' ? JSON.parse(r.detail) : (r.detail ?? {}),
    })),
    total,
  };
}

/**
 * 写入审计日志
 */
export async function writeAudit(entry: AuditEntry): Promise<void> {
  const {
    actorType,
    actorId,
    actorName,
    action,
    targetType,
    targetId,
    targetName,
    detail,
    ipAddress,
    channel,
    result = 'success',
    errorMessage,
  } = entry;

  await query(
    `INSERT INTO audit_logs
      (actor_type, actor_id, actor_name, action, target_type, target_id, target_name, detail, ip_address, channel, result, error_message)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      actorType,
      actorId ?? null,
      actorName ?? null,
      action,
      targetType ?? null,
      targetId ?? null,
      targetName ?? null,
      JSON.stringify(detail ?? {}),
      ipAddress ?? null,
      channel ?? null,
      result,
      errorMessage ?? null,
    ]
  );
}
