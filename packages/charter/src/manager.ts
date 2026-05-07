/**
 * Charter 许可证管理器
 *
 * 管理:
 * - 许可证定义
 * - 许可证实例（用户申请后）
 * - 文档库
 */

import type {
  CharterDefinition,
  CharterInstance,
  CharterRequest,
  CharterCheckResult,
  CharterStatus,
  DocumentLibrary,
  CharterCapability,
} from './types.js'
import { BUILTIN_CHARTERS, getBuiltinCharter } from './charters/index.js'
import { BUILTIN_LIBRARIES, getBuiltinLibrary } from './libraries/index.js'

/**
 * 许可证管理器
 */
export class CharterManager {
  private charters: Map<string, CharterDefinition> = new Map()
  private instances: Map<string, CharterInstance> = new Map()
  private libraries: Map<string, DocumentLibrary> = new Map()
  private userCharters: Map<string, Set<string>> = new Map() // userId -> charter instance IDs

  constructor() {
    // 加载内置许可证和文档库
    for (const [type, charter] of Object.entries(BUILTIN_CHARTERS)) {
      this.charters.set(charter.id, charter)
    }
    for (const [name, library] of Object.entries(BUILTIN_LIBRARIES)) {
      this.libraries.set(library.id, library)
    }
  }

  /**
   * 获取许可证定义
   */
  getCharterDefinition(id: string): CharterDefinition | undefined {
    return this.charters.get(id)
  }

  /**
   * 获取许可证定义（按类型）
   */
  getCharterByType(type: string): CharterDefinition | undefined {
    return getBuiltinCharter(type) || this.charters.get(`charter-${type}`)
  }

  /**
   * 列出所有许可证定义
   */
  listCharterDefinitions(): CharterDefinition[] {
    return Array.from(this.charters.values())
  }

  /**
   * 获取文档库
   */
  getLibrary(id: string): DocumentLibrary | undefined {
    return this.libraries.get(id) || getBuiltinLibrary(id)
  }

  /**
   * 申请许可证
   */
  requestCharter(userId: string, request: CharterRequest): CharterInstance {
    const definition = this.getCharterByType(request.type)
    if (!definition) {
      throw new Error(`Unknown charter type: ${request.type}`)
    }

    const instanceId = `instance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const instance: CharterInstance = {
      id: instanceId,
      charterId: definition.id,
      userId,
      sessionId: request.sessionId,
      status: 'pending',
      reason: request.reason,
      createdAt: Date.now(),
    }

    this.instances.set(instanceId, instance)

    // 记录用户许可证
    if (!this.userCharters.has(userId)) {
      this.userCharters.set(userId, new Set())
    }
    this.userCharters.get(userId)!.add(instanceId)

    // 如果不需要确认，自动激活
    if (!definition.requireConfirmation) {
      this.activateCharter(instanceId, userId)
    }

    return instance
  }

  /**
   * 激活许可证
   */
  activateCharter(instanceId: string, approvedBy: string): CharterInstance {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`)
    }

    if (instance.status !== 'pending') {
      throw new Error(`Instance already processed: ${instance.status}`)
    }

    const definition = this.getCharterDefinition(instance.charterId)
    if (!definition) {
      throw new Error(`Definition not found: ${instance.charterId}`)
    }

    const now = Date.now()
    instance.status = 'active'
    instance.approvedAt = now
    instance.approvedBy = approvedBy
    instance.activatedAt = now
    instance.expiresAt = definition.validityMs > 0 ? now + definition.validityMs : undefined

    return instance
  }

  /**
   * 撤销许可证
   */
  revokeCharter(instanceId: string, reason: string): CharterInstance {
    const instance = this.instances.get(instanceId)
    if (!instance) {
      throw new Error(`Instance not found: ${instanceId}`)
    }

    instance.status = 'revoked'
    instance.revokedReason = reason

    return instance
  }

  /**
   * 获取用户的许可证实例
   */
  getUserCharters(userId: string): CharterInstance[] {
    const ids = this.userCharters.get(userId)
    if (!ids) return []

    return Array.from(ids)
      .map((id) => this.instances.get(id))
      .filter((instance): instance is CharterInstance => instance !== undefined)
  }

  /**
   * 获取用户活跃的许可证
   */
  getActiveCharters(userId: string): CharterInstance[] {
    const now = Date.now()
    return this.getUserCharters(userId).filter((instance) => {
      if (instance.status !== 'active') return false
      if (instance.expiresAt && now > instance.expiresAt) {
        instance.status = 'expired'
        return false
      }
      return true
    })
  }

  /**
   * 检查是否有许可证允许某操作
   */
  checkCapability(userId: string, capabilityName: string, toolName?: string): CharterCheckResult {
    const activeCharters = this.getActiveCharters(userId)

    for (const instance of activeCharters) {
      const definition = this.getCharterDefinition(instance.charterId)
      if (!definition) continue

      for (const capability of definition.capabilities) {
        if (capability.name === capabilityName) {
          // 检查工具权限
          if (toolName) {
            if (capability.disallowedTools?.includes(toolName)) {
              continue
            }
            if (capability.allowedTools && !capability.allowedTools.includes(toolName)) {
              continue
            }
          }

          return {
            allowed: true,
            charter: instance,
            capability,
          }
        }
      }
    }

    return {
      allowed: false,
      reason: `No active charter with capability: ${capabilityName}`,
    }
  }

  /**
   * 检查工具是否被许可证允许
   */
  checkTool(userId: string, toolName: string): CharterCheckResult {
    const activeCharters = this.getActiveCharters(userId)

    // 如果没有活跃许可证，使用默认限制
    if (activeCharters.length === 0) {
      return {
        allowed: false,
        reason: 'No active charter. Default restrictions apply.',
      }
    }

    for (const instance of activeCharters) {
      const definition = this.getCharterDefinition(instance.charterId)
      if (!definition) continue

      for (const capability of definition.capabilities) {
        // 检查是否在禁止列表
        if (capability.disallowedTools?.includes(toolName)) {
          continue
        }

        // 检查是否在允许列表（如果定义了允许列表）
        if (capability.allowedTools) {
          if (capability.allowedTools.includes(toolName)) {
            return {
              allowed: true,
              charter: instance,
              capability,
            }
          }
        } else {
          // 没有定义允许列表，默认允许
          return {
            allowed: true,
            charter: instance,
            capability,
          }
        }
      }
    }

    return {
      allowed: false,
      reason: `Tool ${toolName} not allowed by any active charter`,
    }
  }

  /**
   * 获取许可证绑定的文档库
   */
  getCharterLibrary(charterId: string): DocumentLibrary | undefined {
    const definition = this.getCharterDefinition(charterId)
    if (!definition) return undefined

    return this.getLibrary(definition.libraryId)
  }

  /**
   * 添加自定义许可证定义
   */
  addCharterDefinition(definition: CharterDefinition): void {
    this.charters.set(definition.id, definition)
  }

  /**
   * 添加自定义文档库
   */
  addLibrary(library: DocumentLibrary): void {
    this.libraries.set(library.id, library)
  }

  /**
   * 清理过期许可证
   */
  cleanupExpired(): number {
    const now = Date.now()
    let count = 0

    for (const instance of this.instances.values()) {
      if (instance.status === 'active' && instance.expiresAt && now > instance.expiresAt) {
        instance.status = 'expired'
        count++
      }
    }

    return count
  }

  /**
   * 获取许可证实例
   */
  getInstance(instanceId: string): CharterInstance | undefined {
    return this.instances.get(instanceId)
  }

  /**
   * 获取许可证状态
   */
  getInstanceStatus(instanceId: string): CharterStatus | undefined {
    return this.instances.get(instanceId)?.status
  }
}

/**
 * 全局许可证管理器实例
 */
export const charterManager = new CharterManager()

/**
 * 快捷方法
 */

export function requestCharter(userId: string, request: CharterRequest): CharterInstance {
  return charterManager.requestCharter(userId, request)
}

export function activateCharter(instanceId: string, approvedBy: string): CharterInstance {
  return charterManager.activateCharter(instanceId, approvedBy)
}

export function checkCapability(
  userId: string,
  capabilityName: string,
  toolName?: string,
): CharterCheckResult {
  return charterManager.checkCapability(userId, capabilityName, toolName)
}

export function checkTool(userId: string, toolName: string): CharterCheckResult {
  return charterManager.checkTool(userId, toolName)
}

export function getActiveCharters(userId: string): CharterInstance[] {
  return charterManager.getActiveCharters(userId)
}

export function getCharterLibrary(charterId: string): DocumentLibrary | undefined {
  return charterManager.getCharterLibrary(charterId)
}
