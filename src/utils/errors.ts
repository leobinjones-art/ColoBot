/**
 * 统一错误处理
 */

export enum ErrorCode {
  // 通用错误
  UNKNOWN = 'UNKNOWN',
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',

  // LLM 相关
  LLM_ERROR = 'LLM_ERROR',
  LLM_RATE_LIMIT = 'LLM_RATE_LIMIT',
  LLM_CONTEXT_TOO_LONG = 'LLM_CONTEXT_TOO_LONG',

  // 数据库相关
  DB_ERROR = 'DB_ERROR',
  DB_CONNECTION_ERROR = 'DB_CONNECTION_ERROR',

  // Agent 相关
  AGENT_NOT_FOUND = 'AGENT_NOT_FOUND',
  SUBAGENT_LIMIT_REACHED = 'SUBAGENT_LIMIT_REACHED',
  SUBAGENT_TIMEOUT = 'SUBAGENT_TIMEOUT',

  // SOP 相关
  SOP_NOT_FOUND = 'SOP_NOT_FOUND',
  SOP_INVALID_STATE = 'SOP_INVALID_STATE',

  // 工具相关
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_PERMISSION_DENIED = 'TOOL_PERMISSION_DENIED',

  // 审批相关
  APPROVAL_NOT_FOUND = 'APPROVAL_NOT_FOUND',
  APPROVAL_ALREADY_PROCESSED = 'APPROVAL_ALREADY_PROCESSED',
}

export class ColoBotError extends Error {
  code: ErrorCode
  details?: Record<string, unknown>
  recoverable: boolean

  constructor(
    code: ErrorCode,
    message: string,
    options?: { details?: Record<string, unknown>; recoverable?: boolean; cause?: Error }
  ) {
    super(message, { cause: options?.cause })
    this.code = code
    this.details = options?.details
    this.recoverable = options?.recoverable ?? false
    this.name = 'ColoBotError'
  }
}

/**
 * 创建错误
 */
export function createError(
  code: ErrorCode,
  message: string,
  options?: { details?: Record<string, unknown>; recoverable?: boolean; cause?: Error }
): ColoBotError {
  return new ColoBotError(code, message, options)
}

/**
 * 判断是否为 ColoBotError
 */
export function isColoBotError(error: unknown): error is ColoBotError {
  return error instanceof ColoBotError
}

/**
 * 获取错误码
 */
export function getErrorCode(error: unknown): ErrorCode {
  if (isColoBotError(error)) {
    return error.code
  }
  return ErrorCode.UNKNOWN
}

/**
 * 判断错误是否可恢复
 */
export function isRecoverable(error: unknown): boolean {
  if (isColoBotError(error)) {
    return error.recoverable
  }
  return false
}

/**
 * 格式化错误为用户友好消息
 */
export function formatErrorMessage(error: unknown, locale: 'zh' | 'en' = 'zh'): string {
  const messages: Record<ErrorCode, { zh: string; en: string }> = {
    [ErrorCode.UNKNOWN]: {
      zh: '发生未知错误，请稍后重试',
      en: 'An unknown error occurred, please try again later',
    },
    [ErrorCode.INVALID_INPUT]: {
      zh: '输入无效，请检查后重试',
      en: 'Invalid input, please check and try again',
    },
    [ErrorCode.NOT_FOUND]: {
      zh: '请求的资源不存在',
      en: 'The requested resource was not found',
    },
    [ErrorCode.UNAUTHORIZED]: {
      zh: '未授权，请检查 API Key',
      en: 'Unauthorized, please check your API Key',
    },
    [ErrorCode.FORBIDDEN]: {
      zh: '权限不足',
      en: 'Permission denied',
    },
    [ErrorCode.LLM_ERROR]: {
      zh: 'AI 模型调用失败，请稍后重试',
      en: 'AI model call failed, please try again later',
    },
    [ErrorCode.LLM_RATE_LIMIT]: {
      zh: '请求过于频繁，请稍后重试',
      en: 'Rate limit exceeded, please try again later',
    },
    [ErrorCode.LLM_CONTEXT_TOO_LONG]: {
      zh: '对话内容过长，请精简后重试',
      en: 'Context too long, please simplify and try again',
    },
    [ErrorCode.DB_ERROR]: {
      zh: '数据库错误，请稍后重试',
      en: 'Database error, please try again later',
    },
    [ErrorCode.DB_CONNECTION_ERROR]: {
      zh: '数据库连接失败，请检查配置',
      en: 'Database connection failed, please check configuration',
    },
    [ErrorCode.AGENT_NOT_FOUND]: {
      zh: 'Agent 不存在',
      en: 'Agent not found',
    },
    [ErrorCode.SUBAGENT_LIMIT_REACHED]: {
      zh: '子 Agent 数量已达上限',
      en: 'Sub-agent limit reached',
    },
    [ErrorCode.SUBAGENT_TIMEOUT]: {
      zh: '子 Agent 执行超时',
      en: 'Sub-agent execution timeout',
    },
    [ErrorCode.SOP_NOT_FOUND]: {
      zh: 'SOP 流程不存在',
      en: 'SOP workflow not found',
    },
    [ErrorCode.SOP_INVALID_STATE]: {
      zh: 'SOP 流程状态无效',
      en: 'Invalid SOP workflow state',
    },
    [ErrorCode.TOOL_EXECUTION_ERROR]: {
      zh: '工具执行失败',
      en: 'Tool execution failed',
    },
    [ErrorCode.TOOL_NOT_FOUND]: {
      zh: '工具不存在',
      en: 'Tool not found',
    },
    [ErrorCode.TOOL_PERMISSION_DENIED]: {
      zh: '工具权限不足',
      en: 'Tool permission denied',
    },
    [ErrorCode.APPROVAL_NOT_FOUND]: {
      zh: '审批请求不存在',
      en: 'Approval request not found',
    },
    [ErrorCode.APPROVAL_ALREADY_PROCESSED]: {
      zh: '审批请求已处理',
      en: 'Approval request already processed',
    },
  }

  if (isColoBotError(error)) {
    const msg = messages[error.code]?.[locale] || messages[ErrorCode.UNKNOWN][locale]
    return error.details ? `${msg} (${JSON.stringify(error.details)})` : msg
  }

  if (error instanceof Error) {
    return error.message
  }

  return messages[ErrorCode.UNKNOWN][locale]
}

/**
 * 安全执行函数，捕获异常并返回默认值
 */
export async function safeExecute<T>(
  fn: () => Promise<T>,
  fallback: T,
  onError?: (error: Error) => void
): Promise<T> {
  try {
    return await fn()
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    onError?.(error)
    console.error('[safeExecute] Error:', error.message)
    return fallback
  }
}

/**
 * 带重试的执行
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number
    delayMs?: number
    shouldRetry?: (error: Error) => boolean
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, shouldRetry } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))

      if (attempt < maxRetries) {
        const shouldRetryResult = shouldRetry ? shouldRetry(lastError) : true
        if (!shouldRetryResult) {
          throw lastError
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)))
      }
    }
  }

  throw lastError
}
