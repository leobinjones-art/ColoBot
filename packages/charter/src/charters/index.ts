/**
 * 内置许可证导出
 */

export { ACADEMIC_CHARTER } from './academic.js'
export { LEGAL_CHARTER } from './legal.js'
export { LONGDOC_CHARTER } from './longdoc.js'

import { ACADEMIC_CHARTER } from './academic.js'
import { LEGAL_CHARTER } from './legal.js'
import { LONGDOC_CHARTER } from './longdoc.js'
import type { CharterDefinition } from '../types.js'

/**
 * 所有内置许可证
 */
export const BUILTIN_CHARTERS: Record<string, CharterDefinition> = {
  academic: ACADEMIC_CHARTER,
  legal: LEGAL_CHARTER,
  longdoc: LONGDOC_CHARTER,
}

/**
 * 获取内置许可证
 */
export function getBuiltinCharter(type: string): CharterDefinition | undefined {
  return BUILTIN_CHARTERS[type]
}

/**
 * 列出所有内置许可证类型
 */
export function listBuiltinCharterTypes(): string[] {
  return Object.keys(BUILTIN_CHARTERS)
}
