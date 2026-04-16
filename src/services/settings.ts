/**
 * 应用设置服务 - 存储飞书/API 等配置
 */

import { query, queryOne } from '../memory/db.js';

export interface AppSetting {
  key: string;
  value: string;
  description: string | null;
  updated_at: Date;
}

/**
 * 获取单个配置
 */
export async function getSetting(key: string): Promise<string | null> {
  const row = await queryOne<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = $1',
    [key]
  );
  return row?.value ?? null;
}

/**
 * 获取多个配置
 */
export async function getSettings(keys: string[]): Promise<Record<string, string>> {
  if (!keys.length) return {};
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(',');
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM app_settings WHERE key IN (${placeholders})`,
    keys
  );
  return Object.fromEntries(rows.map(r => [r.key, r.value]));
}

/**
 * 设置单个配置
 */
export async function setSetting(key: string, value: string, description?: string): Promise<void> {
  await query(
    `INSERT INTO app_settings (key, value, description, updated_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value, description ?? null]
  );
}

/**
 * 设置多个配置
 */
export async function setSettings(settings: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    await setSetting(key, value);
  }
}

/**
 * 删除配置
 */
export async function deleteSetting(key: string): Promise<void> {
  await query('DELETE FROM app_settings WHERE key = $1', [key]);
}

// 飞书配置 key 常量
export const SETTINGS_KEYS = {
  LARK_APP_ID: 'lark_app_id',
  LARK_APP_SECRET: 'lark_app_secret',
  LARK_VERIFICATION_TOKEN: 'lark_verification_token',
  FEISHU_APPROVER_OPEN_ID: 'feishu_approver_open_id',
  FEISHU_WEBHOOK_URL: 'feishu_webhook_url',
  COLOBOT_PUBLIC_URL: 'colobot_public_url',
  SUBAGENT_ALLOWED_TOOLS: 'subagent_allowed_tools',
  SUBAGENT_BLOCKED_TOOLS: 'subagent_blocked_tools',
  SUBAGENT_DEFAULT_TTL_MS: 'subagent_default_ttl_ms',
} as const;

export type FeishuSettings = {
  lark_app_id: string;
  lark_app_secret: string;
  lark_verification_token: string;
  feishu_approver_open_id: string;
  feishu_webhook_url: string;
  colobot_public_url: string;
};

/**
 * 获取飞书配置
 */
export async function getFeishuSettings(): Promise<FeishuSettings> {
  const keys = Object.values(SETTINGS_KEYS);
  const settings = await getSettings(keys);
  return {
    lark_app_id: settings[SETTINGS_KEYS.LARK_APP_ID] || process.env.LARK_APP_ID || '',
    lark_app_secret: settings[SETTINGS_KEYS.LARK_APP_SECRET] || process.env.LARK_APP_SECRET || '',
    lark_verification_token: settings[SETTINGS_KEYS.LARK_VERIFICATION_TOKEN] || process.env.LARK_VERIFICATION_TOKEN || '',
    feishu_approver_open_id: settings[SETTINGS_KEYS.FEISHU_APPROVER_OPEN_ID] || process.env.FEISHU_APPROVER_OPEN_ID || '',
    feishu_webhook_url: settings[SETTINGS_KEYS.FEISHU_WEBHOOK_URL] || process.env.FEISHU_WEBHOOK_URL || '',
    colobot_public_url: settings[SETTINGS_KEYS.COLOBOT_PUBLIC_URL] || process.env.COLOBOT_PUBLIC_URL || '',
  };
}

/**
 * 保存飞书配置
 */
export async function saveFeishuSettings(settings: Partial<FeishuSettings>): Promise<void> {
  const entries = Object.entries(settings).filter(([, v]) => v !== undefined);
  for (const [key, value] of entries) {
    await setSetting(key, value);
  }
}
