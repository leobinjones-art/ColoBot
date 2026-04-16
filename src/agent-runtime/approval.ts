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

    const approval = this.parseRow(row!);

    // 发送外部通知（飞书/邮件/Telegram）
    await this.notifyExternal({
      approvalId: approval.id,
      agentId: approval.agent_id,
      requester: approval.requester,
      actionType: approval.action_type,
      targetResource: approval.target_resource,
      description: approval.description ?? undefined,
      status: 'pending',
    });

    return approval;
  }

  private async notifyExternal(payload: Parameters<typeof import('../services/notifications.js').sendApprovalNotification>[0]): Promise<void> {
    try {
      const { sendApprovalNotification } = await import('../services/notifications.js');
      await sendApprovalNotification(payload);
    } catch (err) {
      console.error('[Approval] External notification error:', err);
    }
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
    const approval = row ? this.parseRow(row) : null;

    // 审批通过后，继续执行被阻止的 LLM 流程
    if (approval) {
      // 先发送外部通知（让审批者知道操作即将执行），再执行危险工具
      await this.notifyExternal({
        approvalId: approval.id,
        agentId: approval.agent_id,
        requester: approval.requester,
        actionType: approval.action_type,
        targetResource: approval.target_resource,
        description: approval.description ?? undefined,
        status: 'approved',
        approver,
      });
      // 动态导入避免循环依赖
      const { continueRun } = await import('./runtime.js');
      // 异步执行，不阻塞 HTTP 响应
      continueRun(id).catch(err => {
        console.error('[Approval] continueRun error:', err);
      });
    }

    // 推送 WebSocket 通知
    await this.notifyWebSocket(id, 'approved');

    return approval;
  }

  async reject(id: string, approver: string, reason: string): Promise<ApprovalRequest | null> {
    const row = await queryOne<ApprovalRequest>(
      `UPDATE approval_requests
       SET status = 'rejected', decided_at = NOW(), approver = $1, result = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING *`,
      [approver, JSON.stringify({ reason }), id]
    );
    const approval = row ? this.parseRow(row) : null;

    // 推送 WebSocket 通知
    await this.notifyWebSocket(id, 'rejected');

    // 发送外部通知
    if (approval) {
      await this.notifyExternal({
        approvalId: approval.id,
        agentId: approval.agent_id,
        requester: approval.requester,
        actionType: approval.action_type,
        targetResource: approval.target_resource,
        description: approval.description ?? undefined,
        status: 'rejected',
        approver,
        reason,
      });
    }

    return approval;
  }

  /**
   * 执行已批准的 dangerous tool
   * 审批通过后，提取 payload 中的工具名和参数，实际执行工具
   */
  async executeApproved(id: string): Promise<{ approval: ApprovalRequest | null; toolResult?: unknown; error?: string }> {
    const approval = await this.get(id);
    if (!approval) {
      return { approval: null, error: 'Approval not found' };
    }
    if (approval.status !== 'approved') {
      return { approval, error: `Approval status is ${approval.status}, not approved` };
    }

    // 从 payload 中提取工具名和参数
    const toolName = (approval.payload as Record<string, unknown>)._toolName as string | undefined;
    if (!toolName) {
      return { approval, error: 'No tool name in approval payload' };
    }

    // 构建工具参数（排除内部字段）
    const toolArgs: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(approval.payload)) {
      if (!k.startsWith('_')) {
        toolArgs[k] = v;
      }
    }

    try {
      // 动态导入避免循环依赖
      const { executeToolCalls } = await import('./tools/executor.js');
      const toolCtx = { agentId: approval.agent_id, sessionKey: '' };
      const results = await executeToolCalls([{ name: toolName, args: toolArgs }], toolCtx);
      const result = results[0];
      if (!result.success) {
        return { approval, error: result.error };
      }
      return { approval, toolResult: result.result };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      return { approval, error: `Tool execution failed: ${error}` };
    }
  }

  /**
   * 推送审批状态变化到 WebSocket
   */
  private async notifyWebSocket(
    approvalId: string,
    action: 'approved' | 'rejected' | 'expired',
    detail?: Record<string, unknown>
  ): Promise<void> {
    try {
      const { pushWsApproval } = await import('../ws-push.js');
      // 查询 pending_conversations 获取 session 信息
      const rows = await query<{ agent_id: string; session_key: string }>(
        'SELECT agent_id, session_key FROM pending_conversations WHERE approval_id = $1',
        [approvalId]
      );
      if (rows.length === 0) {
        // 审批时没有保存 pending_conversations（如一次性审批场景）
        console.warn(`[Approval] No pending_conversation for approval ${approvalId}, skipping WebSocket push`);
        return;
      }
      const { agent_id, session_key } = rows[0];
      pushWsApproval(agent_id, session_key, action, approvalId, detail);
    } catch (err) {
      console.error('[Approval] WebSocket notification error:', err);
    }
  }

  async expireOld(): Promise<number> {
    const result = await query<ApprovalRequest>(
      `UPDATE approval_requests
       SET status = 'expired'
       WHERE status = 'pending' AND expires_at < NOW()
       RETURNING *`
    );
    const rows = result;
    for (const row of rows) {
      const approval = this.parseRow(row);
      await this.notifyWebSocket(approval.id, 'expired');
      await this.notifyExternal({
        approvalId: approval.id,
        agentId: approval.agent_id,
        requester: approval.requester,
        actionType: approval.action_type,
        targetResource: approval.target_resource,
        description: approval.description ?? undefined,
        status: 'expired',
      });
    }
    return rows.length;
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
