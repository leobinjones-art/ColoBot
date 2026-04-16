/**
 * 通知服务 - 支持飞书/邮件/Telegram
 */

import { feishuNotificationsAdapter } from './feishu-notifications.js';

export interface NotificationPayload {
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

export interface NotificationAdapter {
  name: string;
  send(payload: NotificationPayload): Promise<void>;
}

function getEnabledChannels(): NotificationAdapter[] {
  const channels: NotificationAdapter[] = [];

  // 方案 B: 飞书应用 Bot（交互式卡片，含批准/拒绝按钮）
  if (process.env.LARK_APP_ID && process.env.LARK_APP_SECRET) {
    channels.push(feishuNotificationsAdapter);
  }
  // 方案 A: 飞书 Webhook（兼容旧版，仅单向推送）
  else if (process.env.FEISHU_WEBHOOK_URL) {
    channels.push(feishuAdapter);
  }
  if (process.env.SMTP_HOST) {
    channels.push(emailAdapter);
  }
  if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    channels.push(telegramAdapter);
  }

  return channels;
}

export async function sendApprovalNotification(payload: NotificationPayload): Promise<void> {
  const channels = getEnabledChannels();
  await Promise.allSettled(
    channels.map(ch => ch.send(payload).catch(err => {
      console.error(`[Notification] ${ch.name} failed:`, err);
    }))
  );
}

// ─── 飞书 ────────────────────────────────────────────────

const feishuAdapter: NotificationAdapter = {
  name: 'feishu',
  async send(payload) {
    const url = process.env.FEISHU_WEBHOOK_URL!;
    const emoji = payload.status === 'pending' ? '⏳'
      : payload.status === 'approved' ? '✅'
      : payload.status === 'rejected' ? '❌' : '⏰';

    const body = {
      msg_type: 'interactive',
      card: {
        header: {
          title: { tag: 'plain_text', content: `${emoji} 审批请求 - ${payload.actionType}` },
          template: payload.status === 'pending' ? 'yellow' : payload.status === 'approved' ? 'green' : 'red',
        },
        elements: [
          { tag: 'div', content: { tag: 'lark_md', content: `**请求者**: ${payload.requester}\n**操作**: ${payload.actionType}\n**目标**: ${payload.targetResource}\n**描述**: ${payload.description ?? '(无)'}` } },
          { tag: 'hr' },
          { tag: 'div', content: { tag: 'lark_md', content: `审批ID: \`${payload.approvalId}\`` } },
        ],
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Feishu API error: ${res.status}`);
    }
  },
};

// ─── 邮件 ────────────────────────────────────────────────

// 轻量邮件发送（使用 nodemailer，需要 npm i nodemailer）
const emailAdapter: NotificationAdapter = {
  name: 'email',
  async send(payload) {
    let nodemailer: any;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      nodemailer = require('nodemailer');
    } catch {
      console.warn('[Notification] nodemailer not installed, skipping email. Run: npm i nodemailer');
      return;
    }

    const host = process.env.SMTP_HOST!;
    const port = parseInt(process.env.SMTP_PORT || '587');
    const user = process.env.SMTP_USER!;
    const pass = process.env.SMTP_PASS!;
    const to = process.env.SMTP_TO!;
    const from = process.env.SMTP_FROM || user;

    const emoji = payload.status === 'pending' ? '⏳'
      : payload.status === 'approved' ? '✅'
      : payload.status === 'rejected' ? '❌' : '⏰';

    const subject = `${emoji} [ColoBot] 审批请求 - ${payload.actionType}`;
    const text = [
      `ColoBot 审批通知`,
      ``,
      `状态: ${payload.status}`,
      `请求者: ${payload.requester}`,
      `操作类型: ${payload.actionType}`,
      `目标资源: ${payload.targetResource}`,
      `描述: ${payload.description ?? '(无)'}`,
      ``,
      `审批ID: ${payload.approvalId}`,
    ].join('\n');

    const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } });
    await transporter.sendMail({ from, to, subject, text });
  },
};

// ─── Telegram ────────────────────────────────────────────

const telegramAdapter: NotificationAdapter = {
  name: 'telegram',
  async send(payload) {
    const token = process.env.TELEGRAM_BOT_TOKEN!;
    const chatId = process.env.TELEGRAM_CHAT_ID!;

    const emoji = payload.status === 'pending' ? '⏳'
      : payload.status === 'approved' ? '✅'
      : payload.status === 'rejected' ? '❌' : '⏰';

    const text = [
      `${emoji} *ColoBot 审批通知*`,
      ``,
      `*状态*: ${payload.status}`,
      `*请求者*: ${payload.requester}`,
      `*操作*: ${payload.actionType}`,
      `*目标*: ${payload.targetResource}`,
      `*描述*: ${payload.description ?? '(无)'}`,
      ``,
      `审批ID: \`${payload.approvalId}\``,
    ].join('\n');

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      throw new Error(`Telegram API error: ${res.status}`);
    }
  },
};
