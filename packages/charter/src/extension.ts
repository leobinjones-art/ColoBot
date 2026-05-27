/**
 * Charter 扩展系统
 *
 * 支持社区贡献自定义许可证和文档库
 */

import type { CharterDefinition, DocumentLibrary } from './types.js'
import { charterManager } from './manager.js'

// 简单日志实现
const logger = {
  info: (msg: string, data?: object) => {},
  error: (msg: string, data?: object) => console.error(`[CharterExtension] ${msg}`, data ?? ''),
  warn: (msg: string, data?: object) => console.warn(`[CharterExtension] ${msg}`, data ?? ''),
}

// ═══════════════════════════════════════════════════════════════
// JSON Schema 定义
// ═══════════════════════════════════════════════════════════════

/**
 * Charter 定义 Schema（用于验证）
 */
export const CHARTER_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://colomind.org/schemas/charter.json',
  title: 'Charter Definition',
  description: 'AI capability license definition',
  type: 'object',
  required: ['id', 'type', 'name', 'description', 'capabilities', 'libraryId'],
  properties: {
    id: {
      type: 'string',
      pattern: '^charter-[a-z0-9-]+$',
      description: 'Unique charter identifier',
    },
    type: {
      type: 'string',
      pattern: '^[a-z0-9-]+$',
      description: 'Charter type slug',
    },
    name: {
      type: 'string',
      minLength: 3,
      maxLength: 100,
      description: 'Charter display name',
    },
    description: {
      type: 'string',
      minLength: 10,
      maxLength: 500,
      description: 'Charter description',
    },
    capabilities: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            pattern: '^[a-z0-9-]+$',
          },
          description: { type: 'string' },
          allowedTools: {
            type: 'array',
            items: { type: 'string' },
          },
          disallowedTools: {
            type: 'array',
            items: { type: 'string' },
          },
          maxOutputLength: { type: 'number' },
          constraints: { type: 'object' },
        },
      },
    },
    libraryId: {
      type: 'string',
      pattern: '^library-[a-z0-9-]+$',
      description: 'Bound document library ID',
    },
    disclaimer: { type: 'string' },
    validityMs: {
      type: 'number',
      minimum: 60000, // 最少 1 分钟
      maximum: 86400000 * 7, // 最多 7 天
    },
    requireConfirmation: { type: 'boolean' },
    author: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        url: { type: 'string', format: 'uri' },
      },
    },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
  },
}

/**
 * Document Library Schema
 */
export const LIBRARY_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://colomind.org/schemas/library.json',
  title: 'Document Library',
  description: 'Fact source library for preventing hallucination',
  type: 'object',
  required: ['id', 'name', 'description', 'entries'],
  properties: {
    id: {
      type: 'string',
      pattern: '^library-[a-z0-9-]+$',
    },
    name: {
      type: 'string',
      minLength: 3,
      maxLength: 100,
    },
    description: {
      type: 'string',
      minLength: 10,
      maxLength: 500,
    },
    entries: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'type', 'title', 'content'],
        properties: {
          id: { type: 'string' },
          type: {
            type: 'string',
            enum: [
              'template',
              'regulation',
              'guideline',
              'reference',
              'example',
              'citation',
              'standard',
            ],
          },
          title: { type: 'string' },
          content: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
          source: {
            type: 'object',
            properties: {
              url: { type: 'string', format: 'uri' },
              author: { type: 'string' },
              date: { type: 'string' },
            },
          },
        },
      },
    },
    author: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        url: { type: 'string', format: 'uri' },
      },
    },
    version: { type: 'string' },
    license: {
      type: 'string',
      enum: ['MIT', 'Apache-2.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'proprietary'],
    },
  },
}

// ═══════════════════════════════════════════════════════════════
// 验证函数
// ═══════════════════════════════════════════════════════════════

export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * 验证 Charter 定义
 */
export function validateCharterDefinition(charter: unknown): ValidationResult {
  const errors: string[] = []

  // 基础类型检查
  if (typeof charter !== 'object' || charter === null) {
    return { valid: false, errors: ['Charter must be an object'] }
  }

  const c = charter as Record<string, unknown>

  // 必填字段
  const required = ['id', 'type', 'name', 'description', 'capabilities', 'libraryId']
  for (const field of required) {
    if (!c[field]) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // ID 格式
  if (c.id && typeof c.id === 'string') {
    if (!c.id.match(/^charter-[a-z0-9-]+$/)) {
      errors.push('ID must match pattern: charter-[a-z0-9-]+')
    }
  }

  // type 格式
  if (c.type && typeof c.type === 'string') {
    if (!c.type.match(/^^[a-z0-9-]+$/)) {
      errors.push('Type must match pattern: [a-z0-9-]+')
    }
  }

  // capabilities 数组
  if (c.capabilities && Array.isArray(c.capabilities)) {
    if (c.capabilities.length === 0) {
      errors.push('Capabilities must have at least one item')
    }
    for (const cap of c.capabilities) {
      if (!cap.name) {
        errors.push('Each capability must have a name')
      }
    }
  }

  // validityMs 范围
  if (c.validityMs && typeof c.validityMs === 'number') {
    if (c.validityMs < 60000) {
      errors.push('validityMs must be at least 60000 (1 minute)')
    }
    if (c.validityMs > 86400000 * 7) {
      errors.push('validityMs must be at most 604800000 (7 days)')
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * 验证文档库定义
 */
export function validateLibraryDefinition(library: unknown): ValidationResult {
  const errors: string[] = []

  if (typeof library !== 'object' || library === null) {
    return { valid: false, errors: ['Library must be an object'] }
  }

  const l = library as Record<string, unknown>

  // 必填字段
  const required = ['id', 'name', 'description', 'entries']
  for (const field of required) {
    if (!l[field]) {
      errors.push(`Missing required field: ${field}`)
    }
  }

  // ID 格式
  if (l.id && typeof l.id === 'string') {
    if (!l.id.match(/^library-[a-z0-9-]+$/)) {
      errors.push('ID must match pattern: library-[a-z0-9-]+')
    }
  }

  // entries 数组
  if (l.entries && Array.isArray(l.entries)) {
    if (l.entries.length === 0) {
      errors.push('Entries must have at least one item')
    }
    for (const entry of l.entries) {
      if (!entry.id || !entry.type || !entry.title || !entry.content) {
        errors.push('Each entry must have: id, type, title, content')
      }
      if (
        entry.type &&
        ![
          'template',
          'regulation',
          'guideline',
          'reference',
          'example',
          'citation',
          'standard',
        ].includes(entry.type)
      ) {
        errors.push(`Invalid entry type: ${entry.type}`)
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

// ═══════════════════════════════════════════════════════════════
// 加载函数
// ═══════════════════════════════════════════════════════════════

/**
 * 加载 Charter 定义（从对象）
 */
export function loadCharter(charter: CharterDefinition): ValidationResult {
  const result = validateCharterDefinition(charter)
  if (!result.valid) {
    logger.error('Charter validation failed', { errors: result.errors })
    return result
  }

  charterManager.addCharterDefinition(charter)
  logger.info('Charter loaded', { id: charter.id, type: charter.type })
  return { valid: true, errors: [] }
}

/**
 * 加载文档库（从对象）
 */
export function loadLibrary(library: DocumentLibrary): ValidationResult {
  const result = validateLibraryDefinition(library)
  if (!result.valid) {
    logger.error('Library validation failed', { errors: result.errors })
    return result
  }

  charterManager.addLibrary(library)
  logger.info('Library loaded', { id: library.id, name: library.name })
  return { valid: true, errors: [] }
}

/**
 * 批量加载 Charters
 */
export function loadCharters(charters: CharterDefinition[]): {
  loaded: string[]
  failed: Array<{ id: string; errors: string[] }>
} {
  const loaded: string[] = []
  const failed: Array<{ id: string; errors: string[] }> = []

  for (const charter of charters) {
    const result = loadCharter(charter)
    if (result.valid) {
      loaded.push(charter.id)
    } else {
      failed.push({ id: charter.id, errors: result.errors })
    }
  }

  return { loaded, failed }
}

/**
 * 批量加载 Libraries
 */
export function loadLibraries(libraries: DocumentLibrary[]): {
  loaded: string[]
  failed: Array<{ id: string; errors: string[] }>
} {
  const loaded: string[] = []
  const failed: Array<{ id: string; errors: string[] }> = []

  for (const library of libraries) {
    const result = loadLibrary(library)
    if (result.valid) {
      loaded.push(library.id)
    } else {
      failed.push({ id: library.id, errors: result.errors })
    }
  }

  return { loaded, failed }
}

// ═══════════════════════════════════════════════════════════════
// 导出工具
// ═══════════════════════════════════════════════════════════════

/**
 * 导出 Charter 为 JSON
 */
export function exportCharter(charter: CharterDefinition): string {
  return JSON.stringify(charter, null, 2)
}

/**
 * 导出 Library 为 JSON
 */
export function exportLibrary(library: DocumentLibrary): string {
  return JSON.stringify(library, null, 2)
}

/**
 * 导出所有内置 Charters
 */
export function exportBuiltinCharters(): string {
  const charters = charterManager.listCharterDefinitions()
  return JSON.stringify(charters, null, 2)
}
