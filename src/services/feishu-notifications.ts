/**
 * 飞书通知适配器 - 交互式卡片
 * 实现 NotificationAdapter 接口，在审批状态变化时发送飞书卡片消息
 */

import type { NotificationAdapter, NotificationPayload } from './notifications.js';
import { feishuClient } from './feishu.js';

const feishuNotificationsAdapter: NotificationAdapter = {
  name: 'feishu-notifications',
  async send(payload: NotificationPayload) {
    // 优先从 DB 读取，fallback 到环境变量
    const { getSetting, SETTINGS_KEYS } = await import('./settings.js');
    const receiveId = await getSetting(SETTINGS_KEYS.FEISHU_APPROVER_OPEN_ID)
      || process.env.FEISHU_APPROVER_OPEN_ID;

    if (!receiveId) {
      console.warn('[FeishuNotification] FEISHU_APPROVER_OPEN_ID not configured, skipping');
      return;
    }

    const baseUrl = await getSetting(SETTINGS_KEYS.COLOBOT_PUBLIC_URL)
      || process.env.COLOBOT_PUBLIC_URL
      || 'http://localhost:18792';

    const card = buildApprovalCard(payload, baseUrl);
    const messageId = await feishuClient.sendInteractiveCard(receiveId, card);

    console.log(`[FeishuNotification] Sent card for approval ${payload.approvalId}, message_id: ${messageId}`);

    // 如果是 pending 状态，保存 message_id 以便后续更新
    if (payload.status === 'pending') {
      const { query } = await import('../memory/db.js');
      await query(
        'UPDATE approval_requests SET feishu_message_id = $1 WHERE id = $2',
        [messageId, payload.approvalId]
      );
    }
  },
};

export function buildApprovalCard(payload: NotificationPayload, baseUrl: string = 'http://localhost:18792'): object {
  const approveUrl = `${baseUrl}/api/webhooks/feishu/approve?approvalId=${payload.approvalId}&action=approve`;
  const rejectUrl = `${baseUrl}/api/webhooks/feishu/approve?approvalId=${payload.approvalId}&action=reject`;

  const template = payload.status === 'pending' ? 'yellow'
    : payload.status === 'approved' ? 'green'
    : payload.status === 'rejected' ? 'red'
    : 'grey';

  const emoji = payload.status === 'pending' ? '⏳'
    : payload.status === 'approved' ? '✅'
    : payload.status === 'rejected' ? '❌'
    : '⏰';

  const statusText = payload.status === 'pending' ? '待审批'
    : payload.status === 'approved' ? '已批准'
    : payload.status === 'rejected' ? '已拒绝'
    : '已过期';

  const elements: object[] = [
    {
      tag: 'div',
      content: {
        tag: 'lark_md',
        content: `**请求者**: ${payload.requester}\n**操作**: ${payload.actionType}\n**目标**: ${payload.targetResource}\n**描述**: ${payload.description ?? '(无)'}`,
      },
    },
    { tag: 'hr' },
    {
      tag: 'div',
      content: {
        tag: 'lark_md',
        content: `**状态**: ${statusText}${payload.approver ? `\n**审批人**: ${payload.approver}` : ''}${payload.reason ? `\n**原因**: ${payload.reason}` : ''}`,
      },
    },
    { tag: 'hr' },
    {
      tag: 'div',
      content: {
        tag: 'lark_md',
        content: `审批ID: \`${payload.approvalId}\``,
      },
    },
  ];

  // pending 状态添加批准/拒绝按钮
  if (payload.status === 'pending') {
    elements.push({
      tag: 'action',
      actions: [
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '✅ 批准' },
          type: 'primary',
          url: approveUrl,
        },
        {
          tag: 'button',
          text: { tag: 'plain_text', content: '❌ 拒绝' },
          type: 'danger',
          url: rejectUrl,
        },
      ],
    });
  }

  return {
    msg_type: 'interactive',
    card: {
      header: {
        title: { tag: 'plain_text', content: `${emoji} 审批${statusText} - ${payload.actionType}` },
        template,
      },
      elements,
    },
  };
}

export { feishuNotificationsAdapter };
