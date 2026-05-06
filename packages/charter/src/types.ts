/**
 * Charter 许可证类型定义
 *
 * Charter 定义了 AI 可以做什么，绑定了文档库作为事实来源
 */

/**
 * 许可证状态
 */
export type CharterStatus = 'pending' | 'active' | 'expired' | 'revoked'

/**
 * 许可证类型
 */
export type CharterType = 'academic' | 'legal' | 'longdoc' | 'custom' | string

/**
 * 文档库条目
 */
export interface LibraryEntry {
  id: string
  type: 'citation' | 'template' | 'regulation' | 'guideline' | 'reference' | 'example' | 'standard' | string
  title: string
  content: string
  source?: string
  tags?: string[]
  createdAt: number
  updatedAt: number
}

/**
 * 文档库
 */
export interface DocumentLibrary {
  id: string
  name: string
  description: string
  entries: LibraryEntry[]
}

/**
 * 许可证能力定义
 */
export interface CharterCapability {
  /** 能力名称 */
  name: string
  /** 能力描述 */
  description?: string
  /** 允许的工具列表 */
  allowedTools?: string[]
  /** 禁止的工具列表 */
  disallowedTools?: string[]
  /** 最大输出长度 */
  maxOutputLength?: number
  /** 允许的文件类型 */
  allowedFileTypes?: string[]
  /** 自定义约束 */
  constraints?: Record<string, unknown>
}

/**
 * 许可证定义
 */
export interface CharterDefinition {
  /** 许可证 ID */
  id: string
  /** 许可证类型 */
  type: CharterType
  /** 许可证名称 */
  name: string
  /** 许可证描述 */
  description: string
  /** 解锁的能力 */
  capabilities: CharterCapability[]
  /** 绑定的文档库 ID */
  libraryId: string
  /** 免责声明 */
  disclaimer?: string
  /** 有效期（毫秒），0 表示永久 */
  validityMs: number
  /** 是否需要用户确认 */
  requireConfirmation: boolean
  /** 创建时间 */
  createdAt: number
}

/**
 * 许可证实例（用户申请后生成）
 */
export interface CharterInstance {
  /** 实例 ID */
  id: string
  /** 许可证定义 ID */
  charterId: string
  /** 用户 ID */
  userId: string
  /** 会话 ID（可选，绑定到特定会话） */
  sessionId?: string
  /** 状态 */
  status: CharterStatus
  /** 申请原因 */
  reason: string
  /** 审批时间 */
  approvedAt?: number
  /** 审批者（用户自己或系统） */
  approvedBy?: string
  /** 生效时间 */
  activatedAt?: number
  /** 过期时间 */
  expiresAt?: number
  /** 撤销原因 */
  revokedReason?: string
  /** 创建时间 */
  createdAt: number
}

/**
 * 许可证申请请求
 */
export interface CharterRequest {
  /** 许可证类型 */
  type: CharterType
  /** 申请原因 */
  reason: string
  /** 会话 ID（可选） */
  sessionId?: string
  /** 自定义参数 */
  params?: Record<string, unknown>
}

/**
 * 许可证检查结果
 */
export interface CharterCheckResult {
  /** 是否允许 */
  allowed: boolean
  /** 许可证实例 */
  charter?: CharterInstance
  /** 拒绝原因 */
  reason?: string
  /** 匹配的能力 */
  capability?: CharterCapability
}
