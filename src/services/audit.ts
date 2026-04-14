/**
 * 审计日志服务
 */

import { query } from '../memory/db.js';

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
  result?: 'success' | 'failure' | 'error';
  errorMessage?: string;
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
