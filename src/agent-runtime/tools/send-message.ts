/**
 * 危险工具：send_message - 发送消息到各种渠道
 *
 * 支持渠道：webhook / email / feishu / telegram
 * 需要审批（action_type: send）
 */

import { registerTool } from './executor.js';
import {
  getMessageWebhookUrl,
  getFeishuWebhookUrl,
  getSmtpConfig,
  getTelegramConfig,
} from '../../services/settings-cache.js';

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
        const url = webhook_url || getMessageWebhookUrl();
        if (!url) throw new Error('webhook_url is required or MESSAGE_WEBHOOK_URL not configured');
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
        const smtp = getSmtpConfig();
        if (!smtp.host || !smtp.user || !smtp.pass || !smtp.to) {
          throw new Error('SMTP not configured. Set SMTP settings in Dashboard.');
        }
        const transporter = nodemailer.createTransport({ host: smtp.host, port: smtp.port, auth: { user: smtp.user, pass: smtp.pass } });
        await transporter.sendMail({
          from: smtp.from || smtp.user,
          to: to || smtp.to,
          subject: subject || '[ColoBot] 通知',
          text: content,
        });
        return { ok: true, channel: 'email', to: to || smtp.to };
      }

      case 'feishu': {
        const webhook = webhook_url || getFeishuWebhookUrl();
        if (!webhook) throw new Error('webhook_url is required or FEISHU_WEBHOOK_URL not configured');
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
        const tg = getTelegramConfig();
        const chatId = to || tg.chatId;
        if (!tg.botToken || !chatId) {
          throw new Error('Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in Dashboard.');
        }
        const res = await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
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
