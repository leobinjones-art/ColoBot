/**
 * Charter 许可证守护
 *
 * 集成 Charter 许可证系统到 Sentinel
 * - 检查操作是否有许可证授权
 * - 检查工具调用权限
 * - 提供文档库引用
 */

import type {
  CharterCheckResult,
  CharterManager,
  DocumentLibrary,
  LibraryEntry,
} from '@nexusmind/charter'
import {
  CharterManager as CharterManagerClass,
  charterManager as defaultCharterManager,
} from '@nexusmind/charter'
import { createLogger } from './logger.js'

const logger = createLogger('CharterGuard')

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export interface CharterGuardConfig {
  /** 自定义 CharterManager 实例 */
  charterManager?: CharterManager
  /** 默认拒绝时的提示信息 */
  defaultDenyMessage?: string
  /** 是否启用日志 */
  enableLogging?: boolean
}

export interface CapabilityCheckResult {
  allowed: boolean
  reason?: string
  charter?: {
    id: string
    type: string
    expiresAt?: number
  }
  libraryEntries?: LibraryEntry[]
}

// ═══════════════════════════════════════════════════════════════
// Charter 守护类
// ═══════════════════════════════════════════════════════════════

export class CharterGuard {
  private manager: CharterManager
  private config: CharterGuardConfig

  constructor(config: CharterGuardConfig = {}) {
    this.manager = config.charterManager ?? defaultCharterManager
    this.config = {
      defaultDenyMessage: '此操作需要许可证授权',
      enableLogging: true,
      ...config,
    }
  }

  /**
   * 检查能力权限
   */
  checkCapability(
    userId: string,
    capabilityName: string,
    toolName?: string,
  ): CapabilityCheckResult {
    const result = this.manager.checkCapability(userId, capabilityName, toolName)

    if (result.allowed) {
      if (this.config.enableLogging) {
        logger.info('Capability allowed', {
          userId,
          capability: capabilityName,
          charterId: result.charter?.id,
        })
      }

      // 获取相关文档库条目
      const libraryEntries = this.getRelevantLibraryEntries(result)

      return {
        allowed: true,
        charter: result.charter
          ? {
              id: result.charter.id,
              type: result.charter.charterId.replace('charter-', ''),
              expiresAt: result.charter.expiresAt,
            }
          : undefined,
        libraryEntries,
      }
    }

    if (this.config.enableLogging) {
      logger.warn('Capability denied', {
        userId,
        capability: capabilityName,
        reason: result.reason,
      })
    }

    return {
      allowed: false,
      reason: result.reason ?? this.config.defaultDenyMessage,
    }
  }

  /**
   * 检查工具权限
   */
  checkTool(userId: string, toolName: string): CapabilityCheckResult {
    const result = this.manager.checkTool(userId, toolName)

    if (result.allowed) {
      if (this.config.enableLogging) {
        logger.info('Tool allowed', {
          userId,
          tool: toolName,
          charterId: result.charter?.id,
        })
      }

      return {
        allowed: true,
        charter: result.charter
          ? {
              id: result.charter.id,
              type: result.charter.charterId.replace('charter-', ''),
              expiresAt: result.charter.expiresAt,
            }
          : undefined,
      }
    }

    if (this.config.enableLogging) {
      logger.warn('Tool denied', {
        userId,
        tool: toolName,
        reason: result.reason,
      })
    }

    return {
      allowed: false,
      reason: result.reason ?? this.config.defaultDenyMessage,
    }
  }

  /**
   * 获取用户活跃许可证
   */
  getActiveCharters(userId: string) {
    return this.manager.getActiveCharters(userId)
  }

  /**
   * 获取许可证绑定的文档库
   */
  getCharterLibrary(charterId: string): DocumentLibrary | undefined {
    return this.manager.getCharterLibrary(charterId)
  }

  /**
   * 获取相关文档库条目
   */
  private getRelevantLibraryEntries(result: CharterCheckResult): LibraryEntry[] | undefined {
    if (!result.charter || !result.capability) return undefined

    const library = this.getCharterLibrary(result.charter.charterId)
    if (!library) return undefined

    // 根据能力名称筛选相关条目
    const capabilityName = result.capability.name
    const relevantTags = this.getCapabilityTags(capabilityName)

    if (relevantTags.length === 0) {
      return library.entries.slice(0, 3) // 返回前3条
    }

    return library.entries.filter((entry) => entry.tags?.some((tag) => relevantTags.includes(tag)))
  }

  /**
   * 根据能力名称获取相关标签
   */
  private getCapabilityTags(capabilityName: string): string[] {
    const tagMap: Record<string, string[]> = {
      'paper-writing': ['citation', 'academic', 'writing'],
      'literature-review': ['citation', 'academic'],
      'citation-format': ['citation', 'formatting'],
      'contract-draft': ['contract', 'terms'],
      'disclaimer-generate': ['disclaimer', 'template'],
      'legal-analysis': ['contract', 'terms'],
      'long-document-write': ['structure', 'formatting'],
      'document-merge': ['structure'],
      'toc-generate': ['toc', 'formatting'],
    }

    return tagMap[capabilityName] ?? []
  }

  /**
   * 生成许可证申请提示
   */
  generateCharterRequestPrompt(userId: string, capabilityName: string): string {
    const activeCharters = this.getActiveCharters(userId)

    if (activeCharters.length === 0) {
      return `您当前没有活跃的许可证。要使用「${capabilityName}」功能，请先申请相应的许可证。`
    }

    return `您当前的许可证不包含「${capabilityName}」能力。请申请相应的许可证以解锁此功能。`
  }
}

// ═══════════════════════════════════════════════════════════════
// 默认实例
// ═══════════════════════════════════════════════════════════════

let defaultGuard: CharterGuard | null = null

export function getCharterGuard(config?: CharterGuardConfig): CharterGuard {
  if (!defaultGuard) {
    defaultGuard = new CharterGuard(config)
  }
  return defaultGuard
}

export function resetCharterGuard(config?: CharterGuardConfig): CharterGuard {
  defaultGuard = new CharterGuard(config)
  return defaultGuard
}
