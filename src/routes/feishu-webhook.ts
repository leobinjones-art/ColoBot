/**
 * 飞书回调路由
 * 处理飞书事件订阅回调（challenge 验证 + 事件验签 + 按钮点击 + 消息对话）
 */

import { queryOne, query } from '../memory/db.js';
import { createHmac } from 'crypto';

// 消息去重缓存
const processedMessages = new Map<string, number>();
const DEDUP_TTL = 5 * 60 * 1000; // 5分钟

function isDuplicate(messageId: string): boolean {
  const now = Date.now();
  const lastProcessed = processedMessages.get(messageId);
  if (lastProcessed && now - lastProcessed < DEDUP_TTL) {
    return true;
  }
  // 清理过期记录
  for (const [id, time] of processedMessages) {
    if (now - time > DEDUP_TTL) {
      processedMessages.delete(id);
    }
  }
  processedMessages.set(messageId, now);
  return false;
}

function parseBody(req: import('http').IncomingMessage): Promise<{ raw: string; json: Record<string, unknown> }> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve({ raw: body, json: body ? JSON.parse(body) : {} });
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

/**
 * 验证飞书事件签名
 * 签名算法：HMAC-SHA256(timestamp + body, LARK_VERIFICATION_TOKEN)
 * 飞书将签名放在 X-Feishu-Signature header 中
 */
async function verifyFeishuSignature(
  req: import('http').IncomingMessage,
  rawBody: string
): Promise<boolean> {
  const token = process.env.LARK_VERIFICATION_TOKEN;
  if (!token) {
    // 未配置 token 时跳过验证（开发模式）
    console.warn('[FeishuWebhook] LARK_VERIFICATION_TOKEN not set, skipping signature verification');
    return true;
  }

  const timestamp = req.headers['x-feishu-timestamp'] as string | undefined;
  const signature = req.headers['x-feishu-signature'] as string | undefined;

  if (!timestamp || !signature) {
    console.warn('[FeishuWebhook] Missing timestamp or signature header');
    return false;
  }

  // 签名时效：5 分钟内有效，防止重放攻击
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) {
    console.warn('[FeishuWebhook] Signature timestamp expired');
    return false;
  }

  const encoded = timestamp + rawBody;
  const expected = createHmac('sha256', token).update(encoded).digest('hex');
  return expected === signature;
}

/**
 * 处理 GET /api/webhooks/feishu（challenge 验证）
 * 或 POST /api/webhooks/feishu（飞书事件回调 + 验签）
 */
export async function handleFeishuEvent(req: import('http').IncomingMessage): Promise<Record<string, unknown>> {
  const { raw: rawBody, json: body } = await parseBody(req);

  // challenge 验证（飞书事件订阅配置时）
  if (body.challenge) {
    return { challenge: body.challenge as string };
  }

  // 验签（非 challenge 事件必须验签）
  const valid = await verifyFeishuSignature(req, rawBody);
  if (!valid) {
    console.warn('[FeishuWebhook] Signature verification failed');
    throw Object.assign(new Error('Signature verification failed'), { status: 403 });
  }

  // 飞书事件回调
  console.log('[FeishuWebhook] Event received:', JSON.stringify(body).slice(0, 200));

  // 处理消息事件
  const event = body.event as Record<string, unknown> | undefined;
  if (event && event.type === 'message') {
    await handleFeishuMessage(event);
  }

  return { ok: true };
}

/**
 * 处理飞书消息，调用 Agent 回复
 */
async function handleFeishuMessage(event: Record<string, unknown>): Promise<void> {
  const message = event.message as Record<string, unknown> | undefined;
  if (!message) return;

  const content = message.content as string;
  const messageId = (message.message_id as string) || `unknown-${Date.now()}`;
  const sender = message.sender as Record<string, unknown> | undefined;
  const senderId = sender?.id as string || 'unknown';
  const chatType = message.chat_type as string;

  // 消息去重
  if (isDuplicate(messageId)) {
    console.log(`[FeishuWebhook] ⏭️ 跳过重复消息: ${messageId}`);
    return;
  }

  // 只处理私聊和群聊文本消息
  if (chatType !== 'p2p' && chatType !== 'group') return;

  // 解析消息内容
  let text = '';
  try {
    const contentJson = JSON.parse(content);
    text = contentJson.text || '';
  } catch {
    text = content;
  }

  if (!text.trim()) return;

  console.log(`[FeishuWebhook] Message from ${senderId}: ${text.slice(0, 50)}...`);

  // 获取绑定的 Agent
  const { getSetting, SETTINGS_KEYS } = await import('../services/settings.js');
  const agentId = await getSetting(SETTINGS_KEYS.FEISHU_AGENT_ID);

  if (!agentId) {
    console.warn('[FeishuWebhook] No agent bound to Feishu, set feishu_agent_id in settings');
    return;
  }

  // 获取 Agent 信息
  const agent = await queryOne<{ id: string; name: string; primary_model_id: string; fallback_model_id: string }>(
    'SELECT id, name, primary_model_id, fallback_model_id FROM agents WHERE id = $1',
    [agentId]
  );

  if (!agent) {
    console.warn(`[FeishuWebhook] Agent ${agentId} not found`);
    return;
  }

  try {
    // 调用 Agent 运行时
    const { runAgent } = await import('../agent-runtime/runtime.js');
    const result = await runAgent({
      agentId,
      sessionKey: `feishu-${senderId}`,
      userMessage: text,
    });

    // 发送回复
    const { feishuClient } = await import('../services/feishu.js');

    if ('pending' in result && result.pending) {
      // 需要审批，发送等待消息
      await feishuClient.sendTextMessage(senderId, '您的请求需要审批，请等待审批人处理。');
    } else if ('response' in result) {
      const responseText = typeof result.response === 'string' ? result.response : JSON.stringify(result.response);
      await feishuClient.sendTextMessage(senderId, responseText);
    }
    console.log(`[FeishuWebhook] Replied to ${senderId}`);
  } catch (e) {
    console.error('[FeishuWebhook] Failed to process message:', e);
  }
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
