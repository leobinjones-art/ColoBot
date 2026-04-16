/**
 * 飞书回调路由
 * 处理飞书事件订阅回调（challenge 验证 + 按钮点击）
 */

import { queryOne } from '../memory/db.js';

function parseBody(req: import('http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * 处理 GET /api/webhooks/feishu（challenge 验证）
 * 或 POST /api/webhooks/feishu（飞书事件回调）
 */
export async function handleFeishuEvent(req: import('http').IncomingMessage): Promise<Record<string, unknown>> {
  const body = await parseBody(req);

  // challenge 验证（飞书事件订阅配置时）
  if (body.challenge) {
    return { challenge: body.challenge as string };
  }

  // 飞书事件回调（暂不处理自动逻辑，依赖按钮回调）
  console.log('[FeishuWebhook] Event received:', JSON.stringify(body).slice(0, 200));

  return { ok: true };
}

/**
 * 处理 GET /api/webhooks/feishu/approve
 * 飞书按钮点击回调（URL 跳转方式）
 */
export async function handleApproveCallback(query: URLSearchParams): Promise<{ ok: boolean; action: string; approvalId: string; error?: string }> {
  const approvalId = query.get('approvalId');
  const action = query.get('action');

  if (!approvalId || !action) {
    return { ok: false, action: action || 'unknown', approvalId: approvalId || 'unknown', error: 'Missing approvalId or action' };
  }

  if (action !== 'approve' && action !== 'reject') {
    return { ok: false, action, approvalId, error: 'Invalid action' };
  }

  // 检查审批状态
  const approval = await queryOne<{
    id: string;
    status: string;
    feishu_message_id: string | null;
  }>('SELECT id, status, feishu_message_id FROM approval_requests WHERE id = $1', [approvalId]);

  if (!approval) {
    return { ok: false, action, approvalId, error: 'Approval not found' };
  }

  if (approval.status !== 'pending') {
    return { ok: false, action, approvalId, error: `Approval is ${approval.status}, not pending` };
  }

  // 调用审批流
  const { approvalFlow } = await import('../agent-runtime/approval.js');

  if (action === 'approve') {
    await approvalFlow.approve(approvalId, 'feishu-user');
  } else {
    await approvalFlow.reject(approvalId, 'feishu-user', '用户在飞书点击拒绝');
  }

  // 更新飞书卡片（变为已批准/已拒绝状态）
  if (approval.feishu_message_id) {
    const { feishuClient } = await import('../services/feishu.js');
    const { buildApprovalCard } = await import('../services/feishu-notifications.js');
    const payload = await getApprovalPayload(approvalId);
    if (payload) {
      const card = buildApprovalCard({ ...payload, status: action === 'approve' ? 'approved' : 'rejected' });
      try {
        await feishuClient.updateMessage(approval.feishu_message_id, card);
      } catch (e) {
        console.error('[FeishuWebhook] Failed to update card:', e);
      }
    }
  }

  console.log(`[FeishuWebhook] Approval ${approvalId} ${action}d via Feishu button`);

  return { ok: true, action, approvalId };
}

interface ApprovalPayload {
  approvalId: string;
  agentId: string;
  requester: string;
  actionType: string;
  targetResource: string;
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  approver?: string;
  reason?: string;
}

async function getApprovalPayload(approvalId: string): Promise<ApprovalPayload | null> {
  const row = await queryOne<Record<string, unknown>>(
    'SELECT agent_id, requester, action_type, target_resource, description, status, approver FROM approval_requests WHERE id = $1',
    [approvalId]
  );
  if (!row) return null;
  return {
    approvalId,
    agentId: row.agent_id as string,
    requester: row.requester as string,
    actionType: row.action_type as string,
    targetResource: row.target_resource as string,
    description: row.description as string | undefined,
    status: row.status as 'pending' | 'approved' | 'rejected' | 'expired',
    approver: row.approver as string | undefined,
  };
}
