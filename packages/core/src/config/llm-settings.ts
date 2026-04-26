/**
 * LLM 设置缓存层
 */

import { query, queryOne } from '../memory/db.js';

export type ProviderType = 'openai' | 'anthropic' | 'minimax';

export const LLM_SETTINGS_KEYS = {
  MOCK_LLM: 'mock_llm',
  LLM_PROVIDER: 'llm_provider',
  OPENAI_API_KEY: 'openai_api_key',
  ANTHROPIC_API_KEY: 'anthropic_api_key',
  MINIMAX_API_KEY: 'minimax_api_key',
  DEFAULT_MODEL: 'default_model',
} as const;

type CacheKey = typeof LLM_SETTINGS_KEYS[keyof typeof LLM_SETTINGS_KEYS];

let cache: Map<CacheKey, string> | null = null;
let cacheLoaded = false;

async function loadCache(): Promise<Map<CacheKey, string>> {
  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
    [Object.values(LLM_SETTINGS_KEYS)]
  );
  return new Map(rows.map(r => [r.key as CacheKey, r.value]));
}

export async function refreshLlmSettingsCache(): Promise<void> {
  try {
    cache = await loadCache();
    cacheLoaded = true;
  } catch {
    // DB not ready yet
  }
}

function getCached(key: CacheKey, fallback: string): string {
  if (cache && cache.has(key)) return cache.get(key)!;
  return fallback;
}

function getEnv(key: string): string | undefined {
  return process.env[key];
}

async function ensureCache(): Promise<void> {
  if (!cacheLoaded) await refreshLlmSettingsCache();
}

// ─── Public Getters ─────────────────────────────────────────

export function getMockLLM(): boolean {
  return getCached(LLM_SETTINGS_KEYS.MOCK_LLM, getEnv('MOCK_LLM') || 'false') === 'true';
}

export function getLlmProvider(): ProviderType {
  const v = getCached(LLM_SETTINGS_KEYS.LLM_PROVIDER, getEnv('LLM_PROVIDER') || 'openai');
  if (v === 'anthropic' || v === 'minimax' || v === 'openai') return v;
  return 'openai';
}

export function getOpenAIApiKey(): string {
  return getCached(LLM_SETTINGS_KEYS.OPENAI_API_KEY, getEnv('OPENAI_API_KEY') || '');
}

export function getAnthropicApiKey(): string {
  return getCached(LLM_SETTINGS_KEYS.ANTHROPIC_API_KEY, getEnv('ANTHROPIC_API_KEY') || '');
}

export function getMinimaxApiKey(): string {
  return getCached(LLM_SETTINGS_KEYS.MINIMAX_API_KEY, getEnv('MINIMAX_API_KEY') || '');
}

export function getDefaultModel(): string {
  return getCached(LLM_SETTINGS_KEYS.DEFAULT_MODEL, getEnv('DEFAULT_MODEL') || '');
}

// ─── Public Setters ─────────────────────────────────────────

export async function saveLlmSettings(settings: {
  mock_llm?: boolean;
  llm_provider?: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
  minimax_api_key?: string;
  default_model?: string;
}): Promise<void> {
  const pairs: [string, string][] = [];
  if (settings.mock_llm !== undefined) pairs.push([LLM_SETTINGS_KEYS.MOCK_LLM, String(settings.mock_llm)]);
  if (settings.llm_provider !== undefined) pairs.push([LLM_SETTINGS_KEYS.LLM_PROVIDER, settings.llm_provider]);
  if (settings.openai_api_key) pairs.push([LLM_SETTINGS_KEYS.OPENAI_API_KEY, settings.openai_api_key]);
  if (settings.anthropic_api_key) pairs.push([LLM_SETTINGS_KEYS.ANTHROPIC_API_KEY, settings.anthropic_api_key]);
  if (settings.minimax_api_key) pairs.push([LLM_SETTINGS_KEYS.MINIMAX_API_KEY, settings.minimax_api_key]);
  if (settings.default_model) pairs.push([LLM_SETTINGS_KEYS.DEFAULT_MODEL, settings.default_model]);

  if (!pairs.length) return;
  await ensureCache();
  for (const [key, value] of pairs) {
    await query(
      `INSERT INTO app_settings (key, value, updated_at) VALUES ($1, $2, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
      [key, value]
    );
  }
  await refreshLlmSettingsCache();
}

export async function getLlmSettings() {
  await ensureCache();
  return {
    mock_llm: getMockLLM(),
    llm_provider: getLlmProvider(),
    openai_api_key: getOpenAIApiKey(),
    anthropic_api_key: getAnthropicApiKey(),
    minimax_api_key: getMinimaxApiKey(),
    default_model: getDefaultModel(),
  };
}
