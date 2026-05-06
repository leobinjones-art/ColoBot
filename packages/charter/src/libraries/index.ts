/**
 * 文档库导出
 */

export { ACADEMIC_LIBRARY } from './academic.js'
export { LEGAL_LIBRARY } from './legal.js'
export { GENERAL_LIBRARY } from './general.js'

import { ACADEMIC_LIBRARY } from './academic.js'
import { LEGAL_LIBRARY } from './legal.js'
import { GENERAL_LIBRARY } from './general.js'
import type { DocumentLibrary } from '../types.js'

/**
 * 所有内置文档库
 */
export const BUILTIN_LIBRARIES: Record<string, DocumentLibrary> = {
  academic: ACADEMIC_LIBRARY,
  legal: LEGAL_LIBRARY,
  general: GENERAL_LIBRARY,
}

/**
 * 获取内置文档库
 */
export function getBuiltinLibrary(id: string): DocumentLibrary | undefined {
  return BUILTIN_LIBRARIES[id] || Object.values(BUILTIN_LIBRARIES).find((lib) => lib.id === id)
}

/**
 * 列出所有内置文档库
 */
export function listBuiltinLibraries(): DocumentLibrary[] {
  return Object.values(BUILTIN_LIBRARIES)
}