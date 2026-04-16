/**
 * 危险工具：send_message - 发送消息到各种渠道
 *
 * 支持渠道：webhook / email / feishu / telegram
 * 需要审批（action_type: send）
 */

import { registerTool } from './executor.js';

function register() {
  /**
   * 发送消息
   * 参数：
   *   channel: 'webhook' | 'email' | 'feishu' | 'telegram'
   *   content: 消息内容（文本）
   *   webhook_url?: 渠道为 webhook 时必填
   *   to?: email/telegram 时使用
   *   subject?: email 时使用
   */
  registerTool('send_message', async (args) => {
    const {
      channel = 'webhook',
      content,
      webhook_url,
      to,
      subject,
    } = args as {
      channel?: string;
      content: string;
      webhook_url?: string;
      to?: string;
      subject?: string;
    };

    if (!content) throw new Error('content is required');

    switch (channel) {
      case 'webhook': {
        const url = webhook_url || process.env.MESSAGE_WEBHOOK_URL;
        if (!url) throw new Error('webhook_url is required or MESSAGE_WEBHOOK_URL env var not set');
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content }),
        });
        if (!res.ok) throw new Error(`Webhook error: ${res.status} ${res.statusText}`);
        const body = await res.text().catch(() => '');
        return { ok: true, channel: 'webhook', status: res.status, response: body };
      }

      case 'email': {
        let nodemailer: any;
        try {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          nodemailer = require('nodemailer');
        } catch {
          throw new Error('nodemailer not installed. Run: npm i nodemailer');
        }
        const host = process.env.SMTP_HOST;
        const port = parseInt(process.env.SMTP_PORT || '587');
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.SMTP_FROM || user;
        const recipient = to || process.env.SMTP_TO;
        if (!host || !user || !pass || !recipient) {
          throw new Error('SMTP env vars (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_TO) are required');
        }
        const transporter = nodemailer.createTransport({ host, port, auth: { user, pass } });
        await transporter.sendMail({
          from,
          to: recipient,
          subject: subject || '[ColoBot] 通知',
          text: content,
        });
        return { ok: true, channel: 'email', to: recipient };
      }

      case 'feishu': {
        const webhook = webhook_url || process.env.FEISHU_WEBHOOK_URL;
        if (!webhook) throw new Error('webhook_url is required or FEISHU_WEBHOOK_URL env var not set');
        const res = await fetch(webhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            msg_type: 'text',
            content: { text: content },
          }),
        });
        if (!res.ok) throw new Error(`Feishu webhook error: ${res.status}`);
        return { ok: true, channel: 'feishu' };
      }

      case 'telegram': {
        const token = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = to || process.env.TELEGRAM_CHAT_ID;
        if (!token || !chatId) {
          throw new Error('TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID env vars are required');
        }
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: content }),
        });
        if (!res.ok) throw new Error(`Telegram error: ${res.status}`);
        return { ok: true, channel: 'telegram', to: chatId };
      }

      default:
        throw new Error(`Unknown channel: ${channel}. Supported: webhook, email, feishu, telegram`);
    }
  });
}

export function registerTools(): void {
  register();
}
