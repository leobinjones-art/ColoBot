/**
 * 飞书 API 客户端
 * 支持 tenant_access_token 管理、消息发送、消息更新
 */

const FEISHU_TOKEN_URL = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
const FEISHU_MESSAGE_URL = 'https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id';

interface TokenCache {
  token: string;
  expiresAt: number;
}

interface FeishuMessageResponse {
  code: number;
  msg: string;
  data?: {
    message_id: string;
  };
}

class FeishuClient {
  private static instance: FeishuClient;
  private tokenCache: TokenCache | null = null;

  static getInstance(): FeishuClient {
    if (!FeishuClient.instance) {
      FeishuClient.instance = new FeishuClient();
    }
    return FeishuClient.instance;
  }

  /**
   * 获取 tenant_access_token，自动缓存和刷新
   */
  async getToken(): Promise<string> {
    // 检查缓存，未过期（提前5分钟buffer）
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 5 * 60 * 1000) {
      return this.tokenCache.token;
    }

    // 优先从 DB 读取，fallback 到环境变量
    const { getSettings, SETTINGS_KEYS } = await import('./settings.js');
    const dbSettings = await getSettings([SETTINGS_KEYS.LARK_APP_ID, SETTINGS_KEYS.LARK_APP_SECRET]);
    const appId = dbSettings[SETTINGS_KEYS.LARK_APP_ID] || process.env.LARK_APP_ID;
    const appSecret = dbSettings[SETTINGS_KEYS.LARK_APP_SECRET] || process.env.LARK_APP_SECRET;

    if (!appId || !appSecret) {
      throw new Error('LARK_APP_ID and LARK_APP_SECRET are required');
    }

    let res: Response;
    try {
      res = await fetch(FEISHU_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
      });
    } catch (e) {
      throw new Error(`Feishu token API network error: ${e}`);
    }

    if (!res.ok) {
      throw new Error(`Feishu token API error: ${res.status}`);
    }

    const data = await res.json() as { code: number; tenant_access_token: string; expire: number };

    if (data.code !== 0) {
      throw new Error(`Feishu token error: ${data.code}`);
    }

    // 缓存（飞书 token 有效期2小时）
    this.tokenCache = {
      token: data.tenant_access_token,
      expiresAt: Date.now() + data.expire * 1000,
    };

    return data.tenant_access_token;
  }

  /**
   * 发送交互式卡片消息
   * @returns message_id 用于后续更新
   */
  async sendInteractiveCard(receiveId: string, card: object): Promise<string> {
    const token = await this.getToken();

    const res = await fetch(FEISHU_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: 'interactive',
        content: JSON.stringify(card),
      }),
    });

    if (!res.ok) {
      throw new Error(`Feishu message API error: ${res.status}`);
    }

    const data = await res.json() as FeishuMessageResponse;

    if (data.code !== 0) {
      throw new Error(`Feishu send error: ${data.code} - ${data.msg || 'unknown'}`);
    }

    return data.data?.message_id || '';
  }

  /**
   * 更新已有消息（用于审批状态变更后更新卡片颜色）
   */
  async updateMessage(messageId: string, card: object): Promise<void> {
    const token = await this.getToken();

    const res = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        content: JSON.stringify(card),
      }),
    });

    if (!res.ok) {
      throw new Error(`Feishu update message API error: ${res.status}`);
    }

    const data = await res.json() as { code: number; msg: string };

    if (data.code !== 0) {
      throw new Error(`Feishu update error: ${data.code} - ${data.msg || 'unknown'}`);
    }
  }

  /**
   * 发送文本消息
   */
  async sendTextMessage(receiveId: string, text: string): Promise<string> {
    const token = await this.getToken();

    console.log(`[FeishuClient] Sending text to ${receiveId}: ${text.slice(0, 50)}...`);

    const res = await fetch(FEISHU_MESSAGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text }),
      }),
    });

    const data = await res.json() as FeishuMessageResponse;
    console.log(`[FeishuClient] API response: code=${data.code}, msg=${data.msg}, message_id=${data.data?.message_id}`);

    if (!res.ok) {
      throw new Error(`Feishu message API error: ${res.status}`);
    }

    if (data.code !== 0) {
      throw new Error(`Feishu send error: ${data.code} - ${data.msg || 'unknown'}`);
    }

    return data.data?.message_id || '';
  }
}

export const feishuClient = FeishuClient.getInstance();
