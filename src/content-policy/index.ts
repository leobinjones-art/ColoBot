/**
 * 内容策略 - 学术内容检测入口
 */

import { matchAcademicCategory, type AcademicCategory } from './rules.js';
import { getSop, type SopDefinition } from './sops.js';

export interface CheckResult {
  triggered: boolean;
  category: AcademicCategory | null;
  sop: SopDefinition | null;
}

export interface CheckResponseResult {
  shouldIntercept: boolean;
  interceptResponse: string | null;
  category: AcademicCategory | null;
}

/**
 * 检查用户消息是否触发学术 SOP
 */
export function checkAcademicTrigger(text: string): CheckResult {
  const category = matchAcademicCategory(text);
  if (!category) {
    return { triggered: false, category: null, sop: null };
  }
  const sop = getSop(category);
  return { triggered: true, category, sop };
}

/**
 * 检查 LLM 响应是否包含学术内容需要拦截
 * （当用户直接在普通对话中要求生成论文等学术内容时）
 */
export function checkAcademicResponse(text: string): CheckResponseResult {
  const category = matchAcademicCategory(text);
  if (!category) {
    return { shouldIntercept: false, interceptResponse: null, category: null };
  }
  const sop = getSop(category);
  return {
    shouldIntercept: true,
    interceptResponse: `检测到您请求生成学术内容。

${sop.welcome}`,
    category,
  };
}
