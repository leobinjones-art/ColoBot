/**
 * 飞书长连接 - 无需公网 IP 接收事件
 * 使用飞书官方 SDK 的 WebSocket 长连接模式
 *
 * 配置步骤：
 * 1. 在飞书开放平台 -> 事件订阅 -> 选择"使用长连接接收事件"
 * 2. 配置 App ID 和 App Secret
 * 3. 绑定 Agent
 */

import { queryOne } from '../memory/db.js';
import * as lark from '@larksuiteoapi/node-sdk';

let wsClient: lark.WSClient | null = null;

/**
 * 获取飞书配置
 */
async function getFeishuConfig(): Promise<{ appId: string; appSecret: string } | null> {
  const { getSettings, SETTINGS_KEYS } = await import('./settings.js');
  const settings = await getSettings([SETTINGS_KEYS.LARK_APP_ID, SETTINGS_KEYS.LARK_APP_SECRET]);
  const appId = settings[SETTINGS_KEYS.LARK_APP_ID] || process.env.LARK_APP_ID;
  const appSecret = settings[SETTINGS_KEYS.LARK_APP_SECRET] || process.env.LARK_APP_SECRET;

  if (!appId || !appSecret) return null;
  return { appId, appSecret };
}

/**
 * 启动长连接
 */
export async function startLongPolling(): Promise<void> {
  const config = await getFeishuConfig();
  if (!config) {
    console.log('[FeishuLongPolling] Not configured, skipping');
    return;
  }

  try {
    console.log(`[FeishuLongPolling] Config: appId=${config.appId}, appSecret=${config.appSecret.slice(0, 8)}...`);
    // 创建 WSClient，启用长连接
    wsClient = new lark.WSClient({
      appId: config.appId,
      appSecret: config.appSecret,
      domain: lark.Domain.Feishu, // 国内版飞书
    });

    // 创建事件分发器
    const eventDispatcher = new lark.EventDispatcher({}).register({
      // 注册消息接收事件
      'im.message.receive_v1': async (data: {
        sender: {
          sender_id?: {
            open_id?: string;
          };
        };
        message: {
          content: string;
          chat_type: string;
        };
      }) => {
        await handleMessageEvent(data);
      },
    });

    // 启动长连接
    await wsClient.start({ eventDispatcher });
    console.log('[FeishuLongPolling] Started with Feishu SDK WSClient');
  } catch (e) {
    const errMsg = (e as Error).message;
    if (errMsg.includes('404')) {
      console.error('[FeishuLongPolling] 长连接未启用。请在飞书开放平台 -> 事件订阅 中选择"使用长连接接收事件"');
    } else {
      console.error('[FeishuLongPolling] Start failed:', errMsg);
    }
    // 30秒后重试
    setTimeout(() => startLongPolling(), 30000);
  }
}

/**
 * 处理飞书消息事件
 */
async function handleMessageEvent(event: {
  sender: {
    sender_id?: {
      open_id?: string;
    };
  };
  message: {
    content: string;
    chat_type: string;
  };
}): Promise<void> {
  const message = event.message;
  const content = message.content || '';
  const senderId = event.sender?.sender_id?.open_id || 'unknown';
  const chatType = message.chat_type;

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

  console.log(`[FeishuLongPolling] 📩 收到消息 from ${senderId}: ${text.slice(0, 50)}...`);

  // 获取绑定的 Agent
  const { getSetting, SETTINGS_KEYS } = await import('./settings.js');
  const agentId = await getSetting(SETTINGS_KEYS.FEISHU_AGENT_ID);

  if (!agentId) {
    console.warn('[FeishuLongPolling] No agent bound, set feishu_agent_id in settings');
    return;
  }

  // 获取 Agent 信息
  const agent = await queryOne<{ id: string; name: string }>(
    'SELECT id, name FROM agents WHERE id = $1',
    [agentId]
  );

  if (!agent) {
    console.warn(`[FeishuLongPolling] Agent ${agentId} not found`);
    return;
  }

  console.log(`[FeishuLongPolling] 🔄 分发到 Agent: ${agent.name} (session=feishu-${senderId})`);

  try {
    // 调用 Agent 运行时
    const { runAgent } = await import('../agent-runtime/runtime.js');
    const result = await runAgent({
      agentId,
      sessionKey: `feishu-${senderId}`,
      userMessage: text,
    });

    // 发送回复
    const { feishuClient } = await import('./feishu.js');

    if ('pending' in result && result.pending) {
      console.log(`[FeishuLongPolling] ⏳ 需要审批，等待处理...`);
      await feishuClient.sendTextMessage(senderId, '您的请求需要审批，请等待审批人处理。');
    } else if ('response' in result) {
      const responseText = typeof result.response === 'string' ? result.response : JSON.stringify(result.response);
      console.log(`[FeishuLongPolling] 📤 发送回复: ${responseText.slice(0, 100)}...`);
      await feishuClient.sendTextMessage(senderId, responseText);
    } else {
      console.log(`[FeishuLongPolling] ⚠️ 无响应内容:`, JSON.stringify(result).slice(0, 200));
    }
    console.log(`[FeishuLongPolling] ✅ 处理完成 (session=feishu-${senderId})`);
  } catch (e) {
    console.error('[FeishuLongPolling] Failed to process message:', e);
  }
}

/**
 * 停止长连接
 */
export function stopLongPolling(): void {
  if (wsClient) {
    // WSClient 没有 stop 方法，设为 null 让 GC 处理
    wsClient = null;
  }
}
