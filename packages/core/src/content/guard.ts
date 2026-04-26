/**
 * 内容安全扫描 - 基于 llm-guard 的输入/输出安全扫描
 */

import { LLMGuard } from 'llm-guard';

export interface GuardScanResult {
  safe: boolean;
  reason?: string;
  scanner?: string;
  score?: number;
}

export interface GuardConfig {
  enableInputScan: boolean;
  enableOutputScan: boolean;
  pii: boolean;
  jailbreak: boolean;
  profanity: boolean;
  promptInjection: boolean;
  toxicity: boolean;
  relevance: boolean;
}

const DEFAULT_CONFIG: GuardConfig = {
  enableInputScan: true,
  enableOutputScan: true,
  pii: false,
  jailbreak: true,
  profanity: true,
  promptInjection: true,
  toxicity: true,
  relevance: false,
};

let guard: LLMGuard | null = null;

function getGuard(): LLMGuard {
  if (!guard) {
    guard = new LLMGuard({
      pii: false,
      jailbreak: true,
      profanity: true,
      promptInjection: true,
      relevance: false,
      toxicity: true,
    });
  }
  return guard;
}

/**
 * 扫描输入内容
 */
export async function guardScanInput(
  text: string,
  config: Partial<GuardConfig> = {},
): Promise<GuardScanResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (!cfg.enableInputScan) return { safe: true };

  try {
    const llmGuard = getGuard();
    const response = await llmGuard.validate(text);
    if (response.results.length === 0 || response.results.every(r => r.valid)) {
      return { safe: true };
    }
    const first = response.results.find(r => !r.valid)!;
    return {
      safe: false,
      reason: first.details?.[0]?.message ?? '内容安全扫描未通过',
      scanner: first.details?.[0]?.rule,
      score: first.score,
    };
  } catch (e) {
    console.error('[Guard] Input scan error:', e);
    return { safe: true };
  }
}

/**
 * 扫描输出内容
 */
export async function guardScanOutput(
  text: string,
  config: Partial<GuardConfig> = {},
): Promise<GuardScanResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (!cfg.enableOutputScan) return { safe: true };

  try {
    const llmGuard = getGuard();
    const response = await llmGuard.validate(text);
    if (response.results.length === 0 || response.results.every(r => r.valid)) {
      return { safe: true };
    }
    const first = response.results.find(r => !r.valid)!;
    const reason = first.details?.[0]?.message ?? '内容安全扫描未通过';
    const scanner = first.details?.[0]?.rule;
    console.log('[Guard] Output scan blocked:', { scanner, reason, score: first.score });
    return {
      safe: false,
      reason,
      scanner,
      score: first.score,
    };
  } catch (e) {
    console.error('[Guard] Output scan error:', e);
    return { safe: true };
  }
}
