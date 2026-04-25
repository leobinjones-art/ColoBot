/**
 * 投毒防御系统
 */

import type { TrustLevel } from '@colobot/types';
import { ContentScanner, detectThreat } from './scanner.js';

export interface ContentSource {
  type: 'user_input' | 'ai_generated' | 'external_url' | 'import';
  agentId?: string;
  userId?: string;
  url?: string;
  timestamp: string;
}

export interface ContentValidationResult {
  valid: boolean;
  trustLevel: TrustLevel;
  requiresReview: boolean;
  issues: string[];
  confidence: number;
}

export interface PoisoningAttempt {
  id: string;
  agentId: string;
  contentType: 'memory' | 'skill' | 'rule' | 'profile' | 'knowledge';
  contentKey: string;
  contentPreview: string;
  source: ContentSource;
  issues: string[];
  detectedAt: string;
  actionTaken: 'blocked' | 'flagged' | 'allowed_with_warning';
}

// 投毒检测模式
const POISON_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above)\s+(instructions?|rules?|prompts?)/i,
  /forget\s+(all\s+)?(previous|above)\s+(instructions?|rules?)/i,
  /disregard\s+(all\s+)?(previous|above)/i,
  /override\s+(safety|security|rules?)/i,
  /bypass\s+(safety|security|filter)/i,
  /jailbreak/i,
  /DAN\s*:/i,
  /as\s+an?\s+unrestricted\s+AI/i,
  /you\s+are\s+now\s+free\s+from/i,
  /\[SYSTEM\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
  /忽略\s*(所有|全部)?\s*(之前的|以前的)\s*(指令|规则|提示)/,
  /忘记\s*(所有|全部)?\s*(之前的|以前的)\s*(指令|规则)/,
  /覆盖\s*(安全|规则)/,
  /绕过\s*(安全|检测|过滤)/,
  /越狱/,
];

/**
 * 根据来源判定信任等级
 */
export function determineTrustLevel(source: ContentSource): TrustLevel {
  switch (source.type) {
    case 'user_input':
      return 'high';
    case 'ai_generated':
      return 'medium';
    case 'external_url':
    case 'import':
      return 'low';
    default:
      return 'low';
  }
}

/**
 * 获取写入权限
 */
export function canWrite(source: ContentSource): boolean {
  return source.type === 'ai_generated' || source.type === 'user_input';
}

/**
 * 验证内容安全性
 */
export async function validateContent(
  content: string,
  source: ContentSource,
  scanner?: ContentScanner
): Promise<ContentValidationResult> {
  const trustLevel = determineTrustLevel(source);
  const issues: string[] = [];
  let confidence = 1.0;

  // 基础内容扫描
  if (scanner) {
    const inputScan = await scanner.scanInput(content);
    if (!inputScan.safe) {
      issues.push(`内容安全: ${inputScan.reason}`);
      confidence *= 0.5;
    }
  }

  // 投毒检测
  const poisonDetection = detectPoisoning(content);
  if (poisonDetection.isPoison) {
    issues.push(`投毒检测: ${poisonDetection.reason}`);
    confidence *= 0.3;
  }

  // 格式验证
  const formatValidation = validateFormat(content);
  if (!formatValidation.valid) {
    issues.push(`格式错误: ${formatValidation.reason}`);
    confidence *= 0.8;
  }

  const requiresReview = trustLevel === 'low' || issues.length > 0;

  return {
    valid: issues.length === 0 || (trustLevel !== 'low' && issues.length <= 1),
    trustLevel,
    requiresReview,
    issues,
    confidence,
  };
}

/**
 * 投毒检测
 */
export function detectPoisoning(content: string): { isPoison: boolean; reason?: string } {
  for (const pattern of POISON_PATTERNS) {
    if (pattern.test(content)) {
      return { isPoison: true, reason: `检测到可疑模式: ${pattern.source.slice(0, 50)}` };
    }
  }

  // 检查异常长度
  if (content.length > 100000) {
    return { isPoison: true, reason: '内容异常长，可能包含注入攻击' };
  }

  // 检查重复模式
  const repeatMatch = content.match(/(.{10,})\1{5,}/);
  if (repeatMatch) {
    return { isPoison: true, reason: '检测到重复注入模式' };
  }

  return { isPoison: false };
}

/**
 * 格式验证
 */
function validateFormat(content: string): { valid: boolean; reason?: string } {
  // 检查是否为有效字符串
  if (typeof content !== 'string') {
    return { valid: false, reason: '内容不是有效字符串' };
  }

  // 检查是否为空
  if (content.trim().length === 0) {
    return { valid: false, reason: '内容为空' };
  }

  return { valid: true };
}

/**
 * 记录投毒尝试
 */
export async function recordPoisoningAttempt(
  attempt: Omit<PoisoningAttempt, 'id' | 'detectedAt'>
): Promise<string> {
  const id = crypto.randomUUID();
  // 实际实现应写入数据库
  console.log('[PoisonDefense] Attempt recorded:', id, attempt.issues);
  return id;
}
