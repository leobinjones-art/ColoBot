/**
 * 安全守护日志工具
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void
  info(message: string, data?: Record<string, unknown>): void
  warn(message: string, data?: Record<string, unknown>): void
  error(message: string, data?: Record<string, unknown>): void
}

let currentLevel: LogLevel = 'info'

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

export function setLogLevel(level: LogLevel): void {
  currentLevel = level
}

export function getLogLevel(): LogLevel {
  return currentLevel
}

function timestamp(): string {
  return new Date().toISOString()
}

function format(
  level: LogLevel,
  module: string,
  message: string,
  data?: Record<string, unknown>,
): string {
  const prefix = `[${timestamp()}] [${level.toUpperCase()}] [Sentinel:${module}]`
  if (data && Object.keys(data).length > 0) {
    return `${prefix} ${message} ${JSON.stringify(data)}`
  }
  return `${prefix} ${message}`
}

export function createLogger(moduleName: string): Logger {
  return {
    debug(message: string, data?: Record<string, unknown>): void {
      if (levelPriority.debug >= levelPriority[currentLevel]) {
        console.debug(format('debug', moduleName, message, data))
      }
    },
    info(message: string, data?: Record<string, unknown>): void {
      if (levelPriority.info >= levelPriority[currentLevel]) {
        console.log(format('info', moduleName, message, data))
      }
    },
    warn(message: string, data?: Record<string, unknown>): void {
      if (levelPriority.warn >= levelPriority[currentLevel]) {
        console.warn(format('warn', moduleName, message, data))
      }
    },
    error(message: string, data?: Record<string, unknown>): void {
      if (levelPriority.error >= levelPriority[currentLevel]) {
        console.error(format('error', moduleName, message, data))
      }
    },
  }
}
