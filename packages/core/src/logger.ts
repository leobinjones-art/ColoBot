/**
 * 日志模块 - 为 CLI 和 TUI 提供统一日志功能
 */

import * as fs from 'fs'
import * as path from 'path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LoggerConfig {
  /** 日志文件路径 */
  file?: string
  /** 最低日志级别 */
  level?: LogLevel
  /** 是否输出到控制台 */
  console?: boolean
  /** 日志前缀 */
  prefix?: string
  /** 最大文件大小 (bytes) */
  maxSize?: number
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

/**
 * 日志器
 */
export class Logger {
  private file?: string
  private level: LogLevel
  private console: boolean
  private prefix: string
  private maxSize: number
  private dirCreated: boolean = false

  constructor(config: LoggerConfig = {}) {
    this.file = config.file
    this.level = config.level || 'info'
    this.console = config.console ?? false
    this.prefix = config.prefix || ''
    this.maxSize = config.maxSize || 10 * 1024 * 1024 // 10MB default
  }

  private ensureDir(): void {
    if (this.dirCreated || !this.file) return
    const dir = path.dirname(this.file)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    this.dirCreated = true
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level]
  }

  private formatMessage(level: LogLevel, message: string, meta?: Record<string, unknown>): string {
    const timestamp = new Date().toISOString()
    const prefix = this.prefix ? `[${this.prefix}] ` : ''
    let line = `[${timestamp}] [${level.toUpperCase()}] ${prefix}${message}`
    if (meta && Object.keys(meta).length > 0) {
      line += ` ${JSON.stringify(meta)}`
    }
    return line
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(level)) return

    const line = this.formatMessage(level, message, meta)

    // 写入文件
    if (this.file) {
      try {
        this.ensureDir()
        // 检查文件大小，超过则轮转
        if (fs.existsSync(this.file)) {
          const stat = fs.statSync(this.file)
          if (stat.size > this.maxSize) {
            const backup = `${this.file}.old`
            if (fs.existsSync(backup)) {
              fs.unlinkSync(backup)
            }
            fs.renameSync(this.file, backup)
          }
        }
        fs.appendFileSync(this.file, `${line}\n`)
      } catch {
        // 忽略写入错误
      }
    }

    // 输出到控制台
    if (this.console) {
      const output =
        level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
      output(line)
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta)
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta)
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta)
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta)
  }

  /** 记录用户消息 */
  user(message: string): void {
    this.info('USER', { message: message.slice(0, 500) })
  }

  /** 记录 AI 响应 */
  response(response: string | unknown): void {
    const text = typeof response === 'string' ? response : JSON.stringify(response)
    this.info('RESPONSE', { text: text.slice(0, 500) })
  }

  /** 记录工具调用 */
  toolCall(toolName: string, args?: unknown, result?: unknown): void {
    this.info('TOOL_CALL', {
      tool: toolName,
      args: args ? JSON.stringify(args).slice(0, 200) : undefined,
      result: result ? JSON.stringify(result).slice(0, 200) : undefined,
    })
  }

  /** 记录错误 */
  err(error: unknown): void {
    if (error instanceof Error) {
      this.error('ERROR', { message: error.message, stack: error.stack?.slice(0, 500) })
    } else {
      this.error('ERROR', { error: String(error) })
    }
  }

  /** 创建子日志器 */
  child(prefix: string): Logger {
    return new Logger({
      file: this.file,
      level: this.level,
      console: this.console,
      prefix: this.prefix ? `${this.prefix}:${prefix}` : prefix,
      maxSize: this.maxSize,
    })
  }
}

// 默认日志目录
const LOG_DIR = path.join(process.env.HOME || '', '.colobot', 'logs')

/**
 * 创建 CLI 日志器
 */
export function createCliLogger(config: Partial<LoggerConfig> = {}): Logger {
  return new Logger({
    file: path.join(LOG_DIR, 'cli.log'),
    level: (process.env.COLOBOT_LOG_LEVEL as LogLevel) || 'info',
    console: process.env.COLOBOT_LOG_CONSOLE === 'true',
    ...config,
  })
}

/**
 * 创建 TUI 日志器
 */
export function createTuiLogger(config: Partial<LoggerConfig> = {}): Logger {
  return new Logger({
    file: path.join(LOG_DIR, 'tui.log'),
    level: (process.env.COLOBOT_LOG_LEVEL as LogLevel) || 'info',
    console: process.env.COLOBOT_LOG_CONSOLE === 'true',
    ...config,
  })
}

// 默认导出
export default Logger
