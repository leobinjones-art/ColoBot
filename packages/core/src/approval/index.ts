/**
 * 审批流程 - 四层漏斗
 */

import type { ToolCall } from '@colobot/types';
import { query, queryOne } from '../memory/db.js';

export type ApprovalActionType = 'update' | 'delete' | 'exec' | 'send' | 'uninstall';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type DecisionLevel = 'auto_reject' | 'auto_approve' | 'require_approval';

export interface ApprovalRequest {
  id: string;
  agentId: string;
  requester: string;
  actionType: ApprovalActionType;
  targetResource: string;
  description: string | null;
  payload: Record<string, unknown>;
  status: ApprovalStatus;
  createdAt: Date;
  expiresAt: Date | null;
  decidedAt: Date | null;
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

export interface DecisionResult {
  level: DecisionLevel;
  isCommercialDocument: boolean;
}

// 商业文书标识
const COMMERCIAL_DOC_PATTERNS = [
  '合同', '协议', 'contract', 'agreement', '条款', 'terms',
  '保密协议', 'nda', '采购合同', '销售合同', '租赁合同',
  '授权书', '委托书', 'letter of', 'mou', 'memo of understanding',
];

export function isCommercialDocument(argsStr: string): boolean {
  const lower = argsStr.toLowerCase();
  return COMMERCIAL_DOC_PATTERNS.some(p => lower.includes(p.toLowerCase()));
}

/**
 * 审批流程管理
 */
export class ApprovalFlow {
  /**
   * 创建审批请求
   */
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

  /**
   * 获取审批请求
   */
  async get(id: string): Promise<ApprovalRequest | null> {
    const row = await queryOne<ApprovalRequest>(
      'SELECT * FROM approval_requests WHERE id = $1',
      [id]
    );
    return row ? this.parseRow(row) : null;
  }

  /**
   * 获取待审批列表
   */
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

  /**
   * 批准
   */
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

  /**
   * 拒绝
   */
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

  /**
   * 解析数据库行
   */
  private parseRow(row: ApprovalRequest): ApprovalRequest {
    return {
      ...row,
      payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      result: typeof row.result === 'string' ? JSON.parse(row.result) : row.result,
    };
  }
}

/**
 * 四层漏斗检查
 */
export async function checkDangerousLevel(call: ToolCall): Promise<DecisionResult> {
  const argsStr = JSON.stringify(call.args);
  const isCommercialDoc = isCommercialDocument(argsStr);

  // 第一层：Tirith 规则匹配
  const rule = await findMatchingRule(call.name, argsStr);
  if (rule) {
    if (rule.action === 'reject') {
      return { level: 'auto_reject', isCommercialDocument: isCommercialDoc };
    }
    if (rule.action === 'approve') {
      return { level: 'auto_approve', isCommercialDocument: isCommercialDoc };
    }
    return { level: 'require_approval', isCommercialDocument: isCommercialDoc };
  }

  // 第二层：Pattern 历史匹配
  const patternLevel = await patternMatch(call.name);
  if (patternLevel.level === 'high') {
    return { level: 'require_approval', isCommercialDocument: isCommercialDoc };
  }

  // 第三层：用户行为自进化（简化版）
  // TODO: 实现用户行为统计

  // 第四层：默认需要审批
  return { level: 'require_approval', isCommercialDocument: isCommercialDoc };
}

/**
 * 查找匹配规则
 */
async function findMatchingRule(
  toolName: string,
  argsStr: string
): Promise<{ action: 'reject' | 'approve' | 'require_approval' } | null> {
  // 简化实现：基于关键词匹配
  const dangerousKeywords = ['delete', 'remove', 'drop', 'truncate', 'rm ', '删除', '移除'];
  const safeKeywords = ['read', 'get', 'list', 'search', 'query', '查看', '获取', '列表'];

  const matchStr = (toolName + ' ' + argsStr).toLowerCase();

  for (const kw of dangerousKeywords) {
    if (matchStr.includes(kw.toLowerCase())) {
      return { action: 'require_approval' };
    }
  }

  for (const kw of safeKeywords) {
    if (matchStr.includes(kw.toLowerCase())) {
      return { action: 'approve' };
    }
  }

  return null;
}

/**
 * Pattern 历史匹配
 */
async function patternMatch(toolName: string): Promise<{ level: 'low' | 'medium' | 'high'; count: number }> {
  try {
    const rows = await queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM approval_rule_hits
       WHERE tool_name = $1 AND hit_at > NOW() - INTERVAL '7 days'`,
      [toolName]
    );
    const count = parseInt(rows?.count || '0');
    if (count >= 21) return { level: 'high', count };
    if (count >= 6) return { level: 'medium', count };
    return { level: 'low', count };
  } catch {
    return { level: 'low', count: 0 };
  }
}

/**
 * 记录工具命中
 */
export async function recordToolHit(toolName: string, argsStr: string): Promise<void> {
  try {
    await query(
      `INSERT INTO approval_rule_hits (tool_name, args, hit_at)
       VALUES ($1, $2, NOW())`,
      [toolName, argsStr]
    );
  } catch {
    // 忽略错误
  }
}
