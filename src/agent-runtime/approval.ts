/**
 * 审批流 - ApprovalFlow
 * 危险操作需要审批后才能执行
 */

import { query, queryOne } from '../memory/db.js';

export type ApprovalActionType = 'update' | 'delete' | 'exec' | 'send';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ApprovalRequest {
  id: string;
  agent_id: string;
  requester: string;
  action_type: ApprovalActionType;
  target_resource: string;
  description: string | null;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  created_at: Date;
  expires_at: Date | null;
  decided_at: Date | null;
  approver: string | null;
  result: Record<string, unknown>;
}

export interface ApprovalCreate {
  agentId: string;
  requester: string;
  channel: string;
  actionType: ApprovalActionType;
  targetResource: string;
  description?: string;
  payload?: Record<string, unknown>;
  expiresInMinutes?: number;
}

export class ApprovalFlow {
  async create(input: ApprovalCreate): Promise<ApprovalRequest> {
    const expiresAt = input.expiresInMinutes
      ? new Date(Date.now() + input.expiresInMinutes * 60 * 1000)
      : new Date(Date.now() + 10 * 60 * 1000);

    const payloadWithChannel = { ...(input.payload ?? {}), channel: input.channel };

    const row = await queryOne<ApprovalRequest>(
      `INSERT INTO approval_requests
        (agent_id, requester, action_type, target_resource, description, payload, status, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7)
       RETURNING *`,
      [
        input.agentId,
        input.requester,
        input.actionType,
        input.targetResource,
        input.description ?? null,
        JSON.stringify(payloadWithChannel),
        expiresAt,
      ]
    );

    return this.parseRow(row!);
  }

  async get(id: string): Promise<ApprovalRequest | null> {
    const row = await queryOne<ApprovalRequest>(
      'SELECT * FROM approval_requests WHERE id = $1',
      [id]
    );
    return row ? this.parseRow(row) : null;
  }

  async pending(agentId?: string): Promise<ApprovalRequest[]> {
    let sql = `SELECT * FROM approval_requests
               WHERE status = 'pending' AND (expires_at IS NULL OR expires_at > NOW())`;
    const params: unknown[] = [];
    if (agentId) {
      sql += ' AND agent_id = $1';
      params.push(agentId);
    }
    sql += ' ORDER BY created_at ASC';
    const rows = await query<ApprovalRequest>(sql, params);
    return rows.map(r => this.parseRow(r));
  }

  async approve(id: string, approver: string, result: Record<string, unknown> = {}): Promise<ApprovalRequest | null> {
    const row = await queryOne<ApprovalRequest>(
      `UPDATE approval_requests
       SET status = 'approved', decided_at = NOW(), approver = $1, result = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [approver, JSON.stringify(result), id]
    );
    return row ? this.parseRow(row) : null;
  }

  async reject(id: string, approver: string, reason: string): Promise<ApprovalRequest | null> {
    const row = await queryOne<ApprovalRequest>(
      `UPDATE approval_requests
       SET status = 'rejected', decided_at = NOW(), approver = $1, result = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [approver, JSON.stringify({ reason }), id]
    );
    return row ? this.parseRow(row) : null;
  }

  async expireOld(): Promise<number> {
    const result = await query(
      `UPDATE approval_requests
       SET status = 'expired'
       WHERE status = 'pending' AND expires_at < NOW()`
    );
    return (result as unknown as { rowCount: number }).rowCount;
  }

  static needsApproval(actionType: ApprovalActionType): boolean {
    return ['update', 'delete', 'exec', 'send'].includes(actionType);
  }

  static formatRequest(req: ApprovalRequest): string {
    const lines = [
      `⚠️ **审批请求**`,
      ``,
      `**操作类型**: ${req.action_type}`,
      `**目标资源**: ${req.target_resource}`,
      `**描述**: ${req.description ?? '(无)'}`,
      `**请求者**: ${req.requester}`,
      ``,
      `审批 ID: \`${req.id}\``,
    ];
    return lines.join('\n');
  }

  private parseRow(row: ApprovalRequest): ApprovalRequest {
    return {
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : (row.payload ?? {}),
      result: typeof row.result === 'string' ? JSON.parse(row.result) : (row.result ?? {}),
    };
  }
}

export const approvalFlow = new ApprovalFlow();
