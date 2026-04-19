/**
 * Content Moderation Guard - 基于 llm-guard 的输入/输出安全扫描
 */

import { LLMGuard } from 'llm-guard';

export interface ScanResult {
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

function parseGuardResponse(
  response: { valid: boolean; score?: number; details?: { rule: string; message: string; matched?: string }[] },
): ScanResult {
  if (response.valid) {
    return { safe: true };
  }

  // 第一条失败详情作为 reason
  const detail = response.details?.[0];
  return {
    safe: false,
    reason: detail?.message ?? '内容安全扫描未通过',
    scanner: detail?.rule,
    score: response.score,
  };
}

export async function scanInput(
  text: string,
  config: Partial<GuardConfig> = {},
): Promise<ScanResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (!cfg.enableInputScan) return { safe: true };

  try {
    const llmGuard = getGuard();
    const response = await llmGuard.validate(text);
    // GuardResponse.results is GuardResult[] - check each
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

export async function scanOutput(
  text: string,
  config: Partial<GuardConfig> = {},
): Promise<ScanResult> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  if (!cfg.enableOutputScan) return { safe: true };

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
    console.error('[Guard] Output scan error:', e);
    return { safe: true };
  }
}
