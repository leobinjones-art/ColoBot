/**
 * @colobot/charter
 *
 * Charter 许可证系统
 *
 * 核心概念：
 * - Charter 许可证：定义 AI 可以做什么
 * - Document Library：提供可追溯的事实来源，防止幻觉
 *
 * 设计哲学：
 * - 默认最大限制（防幻觉）
 * - Charter 解锁特定能力
 * - 文档库提供依据
 */

// Types
export type {
  CharterStatus,
  CharterType,
  LibraryEntry,
  DocumentLibrary,
  CharterCapability,
  CharterDefinition,
  CharterInstance,
  CharterRequest,
  CharterCheckResult,
} from './types.js'

// Manager
export { CharterManager, charterManager } from './manager.js'
export {
  requestCharter,
  activateCharter,
  checkCapability,
  checkTool,
  getActiveCharters,
  getCharterLibrary,
} from './manager.js'

// Built-in charters
export {
  ACADEMIC_CHARTER,
  LEGAL_CHARTER,
  LONGDOC_CHARTER,
  BUILTIN_CHARTERS,
  getBuiltinCharter,
  listBuiltinCharterTypes,
} from './charters/index.js'

// Built-in libraries
export {
  ACADEMIC_LIBRARY,
  LEGAL_LIBRARY,
  GENERAL_LIBRARY,
  BUILTIN_LIBRARIES,
  getBuiltinLibrary,
  listBuiltinLibraries,
} from './libraries/index.js'

// Extension system
export {
  CHARTER_SCHEMA,
  LIBRARY_SCHEMA,
  validateCharterDefinition,
  validateLibraryDefinition,
  loadCharter,
  loadLibrary,
  loadCharters,
  loadLibraries,
  exportCharter,
  exportLibrary,
  exportBuiltinCharters,
  type ValidationResult,
} from './extension.js'
