/**
 * 设置缓存层 - 让 DB 设置支持同步访问
 *
 * 策略：启动时从 DB 加载（已初始化则用 DB 值），否则 fallback 到 env。
 * saveSettings() 后自动刷新缓存。
 */

import { query, queryOne } from '../memory/db.js';
import type { ProviderType } from '../llm/index.js';

// ─── Settings Keys ──────────────────────────────────────────

export const C = {
  // LLM
  MOCK_LLM: 'mock_llm',
  LLM_PROVIDER: 'llm_provider',
  OPENAI_API_KEY: 'openai_api_key',
  ANTHROPIC_API_KEY: 'anthropic_api_key',
  MINIMAX_API_KEY: 'minimax_api_key',
  // Notifications
  MESSAGE_WEBHOOK_URL: 'message_webhook_url',
  SMTP_HOST: 'smtp_host',
  SMTP_PORT: 'smtp_port',
  SMTP_USER: 'smtp_user',
  SMTP_PASS: 'smtp_pass',
  SMTP_TO: 'smtp_to',
  SMTP_FROM: 'smtp_from',
  TELEGRAM_BOT_TOKEN: 'telegram_bot_token',
  TELEGRAM_CHAT_ID: 'telegram_chat_id',
  FEISHU_WEBHOOK_URL: 'feishu_webhook_url',
} as const;

type CacheKey = typeof C[keyof typeof C];

// ─── Cache ──────────────────────────────────────────────────

let cache: Map<CacheKey, string> | null = null;
let cacheLoaded = false;

async function loadCache(): Promise<Map<CacheKey, string>> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
    [Object.values(C)]
  );
  return new Map(rows.map(r => [r.key as CacheKey, r.value]));
}

export async function refreshCache(): Promise<void> {
  try {
    cache = await loadCache();
    cacheLoaded = true;
  } catch {
    // DB not ready yet, keep using env fallback
  }
}

function getCached(key: CacheKey, fallback: string): string {
  if (cache && cache.has(key)) return cache.get(key)!;
  return fallback;
}

function getEnv(key: string): string | undefined {
  return process.env[key];
}

// ─── Lazy init on first access ─────────────────────────────

async function ensureCache(): Promise<void> {
  if (!cacheLoaded) await refreshCache();
}

// ─── Public Getters (sync, with env fallback) ─────────────

export function getMockLLM(): boolean {
  return getCached(C.MOCK_LLM, getEnv('MOCK_LLM') || 'false') === 'true';
}

export function getLlmProvider(): ProviderType {
  const v = getCached(C.LLM_PROVIDER, getEnv('LLM_PROVIDER') || 'openai');
  if (v === 'anthropic' || v === 'minimax' || v === 'openai') return v;
  return 'openai';
}

export function getOpenAIApiKey(): string {
  return getCached(C.OPENAI_API_KEY, getEnv('OPENAI_API_KEY') || '');
}

export function getAnthropicApiKey(): string {
  return getCached(C.ANTHROPIC_API_KEY, getEnv('ANTHROPIC_API_KEY') || '');
}

export function getMinimaxApiKey(): string {
  return getCached(C.MINIMAX_API_KEY, getEnv('MINIMAX_API_KEY') || '');
}

// Notifications
export function getMessageWebhookUrl(): string {
  return getCached(C.MESSAGE_WEBHOOK_URL, getEnv('MESSAGE_WEBHOOK_URL') || '');
}

export function getSmtpConfig() {
  return {
    host: getCached(C.SMTP_HOST, getEnv('SMTP_HOST') || ''),
    port: parseInt(getCached(C.SMTP_PORT, getEnv('SMTP_PORT') || '587')),
    user: getCached(C.SMTP_USER, getEnv('SMTP_USER') || ''),
    pass: getCached(C.SMTP_PASS, getEnv('SMTP_PASS') || ''),
    to: getCached(C.SMTP_TO, getEnv('SMTP_TO') || ''),
    from: getCached(C.SMTP_FROM, getEnv('SMTP_FROM') || ''),
  };
}

export function getTelegramConfig() {
  return {
    botToken: getCached(C.TELEGRAM_BOT_TOKEN, getEnv('TELEGRAM_BOT_TOKEN') || ''),
    chatId: getCached(C.TELEGRAM_CHAT_ID, getEnv('TELEGRAM_CHAT_ID') || ''),
  };
}

export function getFeishuWebhookUrl(): string {
  return getCached(C.FEISHU_WEBHOOK_URL, getEnv('FEISHU_WEBHOOK_URL') || '');
}

// ─── Public Setters (save to DB + refresh) ────────────────

export async function saveLlmSettings(settings: {
  mock_llm?: boolean;
  llm_provider?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
  minimax_api_key?: string;
}): Promise<void> {
  const pairs: [string, string][] = [];
  if (settings.mock_llm !== undefined) pairs.push([C.MOCK_LLM, String(settings.mock_llm)]);
  if (settings.llm_provider !== undefined) pairs.push([C.LLM_PROVIDER, settings.llm_provider]);
  // API keys: 只有当值不为空时才保存（避免覆盖已有值）
  if (settings.openai_api_key) pairs.push([C.OPENAI_API_KEY, settings.openai_api_key]);
  if (settings.anthropic_api_key) pairs.push([C.ANTHROPIC_API_KEY, settings.anthropic_api_key]);
  if (settings.minimax_api_key) pairs.push([C.MINIMAX_API_KEY, settings.minimax_api_key]);

  console.log('[saveLlmSettings] Saving:', pairs.map(([k, v]) => `${k}=${v?.slice(0, 8)}...`).join(', '));

  if (!pairs.length) {
    console.log('[saveLlmSettings] No settings to save');
    return;
  }
  await ensureCache();
  for (const [key, value] of pairs) {
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
  }
  await refreshCache();
}

export async function saveNotificationSettings(settings: {
  message_webhook_url?: string;
  smtp_host?: string;
  smtp_port?: string;
  smtp_user?: string;
  smtp_pass?: string;
  smtp_to?: string;
  smtp_from?: string;
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  feishu_webhook_url?: string;
}): Promise<void> {
  const pairs: [string, string][] = [];
  const strPairs = [
    [C.MESSAGE_WEBHOOK_URL, 'message_webhook_url'],
    [C.FEISHU_WEBHOOK_URL, 'feishu_webhook_url'],
    [C.SMTP_HOST, 'smtp_host'],
    [C.SMTP_PORT, 'smtp_port'],
    [C.SMTP_USER, 'smtp_user'],
    [C.SMTP_PASS, 'smtp_pass'],
    [C.SMTP_TO, 'smtp_to'],
    [C.SMTP_FROM, 'smtp_from'],
    [C.TELEGRAM_BOT_TOKEN, 'telegram_bot_token'],
    [C.TELEGRAM_CHAT_ID, 'telegram_chat_id'],
  ] as unknown as [keyof typeof C, string][];
  for (const [cacheKey, settingsKey] of strPairs) {
    if (settings[settingsKey as keyof typeof settings] !== undefined) {
      pairs.push([cacheKey, String(settings[settingsKey as keyof typeof settings])]);
    }
  }

  if (!pairs.length) return;
  await ensureCache();
  for (const [key, value] of pairs) {
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
  }
  await refreshCache();
}

export async function getLlmSettings() {
  await ensureCache();
  return {
    mock_llm: getMockLLM(),
    llm_provider: getLlmProvider(),
    openai_api_key: getOpenAIApiKey(),
    anthropic_api_key: getAnthropicApiKey(),
    minimax_api_key: getMinimaxApiKey(),
  };
}

export async function getNotificationSettings() {
  await ensureCache();
  return {
    message_webhook_url: getMessageWebhookUrl(),
    smtp_host: getCached(C.SMTP_HOST, getEnv('SMTP_HOST') || ''),
    smtp_port: getCached(C.SMTP_PORT, getEnv('SMTP_PORT') || '587'),
    smtp_user: getCached(C.SMTP_USER, getEnv('SMTP_USER') || ''),
    smtp_pass: getCached(C.SMTP_PASS, getEnv('SMTP_PASS') || ''),
    smtp_to: getCached(C.SMTP_TO, getEnv('SMTP_TO') || ''),
    smtp_from: getCached(C.SMTP_FROM, getEnv('SMTP_FROM') || ''),
    telegram_bot_token: getCached(C.TELEGRAM_BOT_TOKEN, getEnv('TELEGRAM_BOT_TOKEN') || ''),
    telegram_chat_id: getCached(C.TELEGRAM_CHAT_ID, getEnv('TELEGRAM_CHAT_ID') || ''),
    feishu_webhook_url: getFeishuWebhookUrl(),
  };
}
