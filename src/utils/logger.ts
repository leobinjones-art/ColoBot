/**
 * 日志工具
 * 提供统一的日志输出接口，便于后续扩展为文件日志或结构化日志
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export interface LoggerOptions {
  level?: LogLevel;
  prefix?: string;
  timestamp?: boolean;
}

class Logger {
  private level: LogLevel;
  private prefix: string;
  private timestamp: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level ?? LogLevel.INFO;
    this.prefix = options.prefix ?? '[ColoBot]';
    this.timestamp = options.timestamp ?? true;
  }

  private format(level: string, message: string, ...args: any[]): string {
    const timestamp = this.timestamp ? new Date().toISOString() + ' ' : '';
    const prefix = this.prefix ? `${this.prefix} ` : '';
    const formattedMessage = `${timestamp}${prefix}${level}: ${message}`;

    if (args.length > 0) {
      console.log(formattedMessage, ...args);
      return formattedMessage;
    } else {
      console.log(formattedMessage);
      return formattedMessage;
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.DEBUG) {
      this.format('DEBUG', message, ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.INFO) {
      this.format('INFO', message, ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.WARN) {
      this.format('WARN', message, ...args);
    }
  }

  error(message: string, ...args: any[]): void {
    if (this.level <= LogLevel.ERROR) {
      this.format('ERROR', message, ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }
}

// 导出默认日志实例
export const logger = new Logger({
  level: process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG,
  prefix: '[ColoBot]',
  timestamp: true,
});

// 导出创建新日志实例的函数
export function createLogger(options: LoggerOptions = {}): Logger {
  return new Logger(options);
}

// 模块特定日志实例
export const authLogger = createLogger({ prefix: '[Auth]' });
export const dbLogger = createLogger({ prefix: '[DB]' });
export const llmLogger = createLogger({ prefix: '[LLM]' });
export const wsLogger = createLogger({ prefix: '[WS]' });
export const approvalLogger = createLogger({ prefix: '[Approval]' });
export const skillLogger = createLogger({ prefix: '[Skill]' });