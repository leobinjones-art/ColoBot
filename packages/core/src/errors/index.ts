/**
 * 全局错误处理
 *
 * 统一错误分类和友好消息
 */

/**
 * 错误类型
 */
export type ErrorCategory =
  | 'user_error'      // 用户输入错误
  | 'auth_error'      // 认证错误
  | 'not_found'       // 资源不存在
  | 'rate_limit'      // 频率限制
  | 'llm_error'       // LLM API 错误
  | 'database_error'  // 数据库错误
  | 'network_error'   // 网络错误
  | 'internal_error'  // 内部错误

/**
 * 应用错误基类
 */
export class AppError extends Error {
  constructor(
    message: string,
    public category: ErrorCategory = 'internal_error',
    public code: string = 'UNKNOWN',
    public statusCode: number = 500,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'AppError'
  }

  toJSON() {
    return {
      error: true,
      category: this.category,
      code: this.code,
      message: this.message,
      details: this.details,
    }
  }
}

/**
 * 用户错误（输入验证等）
 */
export class UserError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 'user_error', 'USER_ERROR', 400, details)
    this.name = 'UserError'
  }
}

/**
 * 认证错误
 */
export class AuthError extends AppError {
  constructor(message: string = '认证失败') {
    super(message, 'auth_error', 'AUTH_FAILED', 401)
    this.name = 'AuthError'
  }
}

/**
 * 资源不存在
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} 不存在`, 'not_found', 'NOT_FOUND', 404)
    this.name = 'NotFoundError'
  }
}

/**
 * 频率限制
 */
export class RateLimitError extends AppError {
  constructor(retryAfter: number = 60) {
    super('请求过于频繁，请稍后再试', 'rate_limit', 'RATE_LIMIT', 429, { retryAfter })
    this.name = 'RateLimitError'
  }
}

/**
 * LLM 错误
 */
export class LLMError extends AppError {
  constructor(message: string, provider?: string) {
    super(message, 'llm_error', 'LLM_ERROR', 502, { provider })
    this.name = 'LLMError'
  }
}

/**
 * 数据库错误
 */
export class DatabaseError extends AppError {
  constructor(message: string = '数据库错误') {
    super(message, 'database_error', 'DB_ERROR', 503)
    this.name = 'DatabaseError'
  }
}

/**
 * 网络错误
 */
export class NetworkError extends AppError {
  constructor(message: string = '网络连接失败') {
    super(message, 'network_error', 'NETWORK_ERROR', 503)
    this.name = 'NetworkError'
  }
}

/**
 * 错误码定义
 */
export const ErrorCodes = {
  // 用户错误
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // 认证错误
  AUTH_FAILED: 'AUTH_FAILED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  // LLM 错误
  LLM_API_KEY_INVALID: 'LLM_API_KEY_INVALID',
  LLM_RATE_LIMIT: 'LLM_RATE_LIMIT',
  LLM_CONTEXT_TOO_LONG: 'LLM_CONTEXT_TOO_LONG',

  // Charter 错误
  CHARTER_NOT_FOUND: 'CHARTER_NOT_FOUND',
  CHARTER_EXPIRED: 'CHARTER_EXPIRED',
  CAPABILITY_DENIED: 'CAPABILITY_DENIED',
} as const

/**
 * 友好错误消息映射
 */
const friendlyMessages: Record<string, string> = {
  // LLM
  'invalid_api_key': 'API Key 无效，请检查配置',
  'rate_limit_exceeded': 'API 请求次数超限，请稍后再试',
  'context_length_exceeded': '内容太长，请减少输入',
  'model_not_found': '模型不可用',

  // 网络
  'ECONNREFUSED': '无法连接服务器',
  'ETIMEDOUT': '连接超时',
  'ENOTFOUND': '网络地址无法解析',

  // 数据库
  'SQLITE_BUSY': '数据库繁忙，请稍后再试',
  'SQLITE_LOCKED': '数据库被锁定',

  // Charter
  'CHARTER_NOT_FOUND': '许可证不存在',
  'CHARTER_EXPIRED': '许可证已过期',
  'CAPABILITY_DENIED': '没有权限执行此操作',
}

/**
 * 获取友好错误消息
 */
export function getFriendlyMessage(error: Error): string {
  // 直接匹配
  if (error.message in friendlyMessages) {
    return friendlyMessages[error.message]
  }

  // 部分匹配
  for (const [key, msg] of Object.entries(friendlyMessages)) {
    if (error.message.includes(key)) {
      return msg
    }
  }

  // AppError 直接返回消息
  if (error instanceof AppError) {
    return error.message
  }

  // 默认消息
  return '发生错误，请稍后再试'
}

/**
 * 将未知错误转换为 AppError
 */
export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error
  }

  if (error instanceof Error) {
    // 根据错误消息判断类型
    const msg = error.message.toLowerCase()

    if (msg.includes('api key') || msg.includes('unauthorized')) {
      return new LLMError(getFriendlyMessage(error))
    }

    if (msg.includes('rate limit')) {
      return new RateLimitError()
    }

    if (msg.includes('not found')) {
      return new NotFoundError('资源')
    }

    if (msg.includes('econnrefused') || msg.includes('etimedout')) {
      return new NetworkError(getFriendlyMessage(error))
    }

    return new AppError(getFriendlyMessage(error))
  }

  return new AppError('未知错误')
}

/**
 * 错误处理中间件（Express 风格）
 */
export function errorHandler(error: unknown, req: unknown, res: {
  status: (code: number) => { json: (body: unknown) => void }
}, next: () => void) {
  const appError = toAppError(error)

  console.error(`[${appError.category}] ${appError.message}`, appError.details)

  res.status(appError.statusCode).json(appError.toJSON())
}
