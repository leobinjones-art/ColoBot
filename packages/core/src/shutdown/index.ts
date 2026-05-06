/**
 * 优雅关闭模块
 *
 * 处理 SIGTERM/SIGINT，确保：
 * 1. 完成进行中的请求
 * 2. 关闭数据库连接
 * 3. 清理子进程
 * 4. 保存未完成的状态
 */

import type { Server } from 'http'

export interface ShutdownOptions {
  /** 服务器实例 */
  server?: Server
  /** 关闭超时时间（毫秒） */
  timeout?: number
  /** 关闭前的清理函数 */
  cleanup?: () => Promise<void>
  /** 关闭完成回调 */
  onShutdown?: () => void
  /** 收到信号回调 */
  onSignal?: (signal: string) => void
  /** 强制关闭回调 */
  onForceShutdown?: () => void
}

/**
 * 优雅关闭管理器
 */
export class GracefulShutdown {
  private server?: Server
  private timeout: number
  private cleanup?: () => Promise<void>
  private onShutdown?: () => void
  private onSignal?: (signal: string) => void
  private onForceShutdown?: () => void
  private isShuttingDown: boolean = false
  private connections: Set<any> = new Set()

  constructor(options: ShutdownOptions = {}) {
    this.server = options.server
    this.timeout = options.timeout || 30000 // 30秒默认
    this.cleanup = options.cleanup
    this.onShutdown = options.onShutdown
    this.onSignal = options.onSignal
    this.onForceShutdown = options.onForceShutdown

    this.setupSignalHandlers()
  }

  /**
   * 设置信号处理器
   */
  private setupSignalHandlers() {
    // SIGTERM - Kubernetes/Docker 发送
    process.on('SIGTERM', () => this.handleSignal('SIGTERM'))

    // SIGINT - Ctrl+C
    process.on('SIGINT', () => this.handleSignal('SIGINT'))

    // SIGHUP - 终端关闭
    process.on('SIGHUP', () => this.handleSignal('SIGHUP'))
  }

  /**
   * 处理关闭信号
   */
  private async handleSignal(signal: string) {
    if (this.isShuttingDown) {
      console.log(`\n已收到 ${signal}，正在关闭...`)
      return
    }

    this.isShuttingDown = true
    console.log(`\n收到 ${signal}，开始优雅关闭...`)

    if (this.onSignal) {
      this.onSignal(signal)
    }

    // 设置强制关闭超时
    const forceTimer = setTimeout(() => {
      console.log('超时，强制关闭')
      if (this.onForceShutdown) {
        this.onForceShutdown()
      }
      process.exit(1)
    }, this.timeout)

    try {
      // 1. 停止接受新连接
      if (this.server) {
        await this.closeServer()
      }

      // 2. 执行清理函数
      if (this.cleanup) {
        await this.cleanup()
      }

      // 3. 关闭完成
      clearTimeout(forceTimer)
      console.log('优雅关闭完成')

      if (this.onShutdown) {
        this.onShutdown()
      }

      process.exit(0)
    } catch (error) {
      console.error('关闭过程中出错:', error)
      clearTimeout(forceTimer)
      process.exit(1)
    }
  }

  /**
   * 关闭服务器
   */
  private async closeServer(): Promise<void> {
    if (!this.server) return

    return new Promise((resolve) => {
      // 停止接受新连接
      this.server!.close(() => {
        console.log('服务器已停止接受新连接')
        resolve()
      })

      // 等待现有连接完成（可选）
      // 这里可以追踪活跃连接并等待它们完成
    })
  }

  /**
   * 添加连接追踪
   */
  trackConnection(conn: any) {
    this.connections.add(conn)
    conn.on('close', () => {
      this.connections.delete(conn)
    })
  }

  /**
   * 获取活跃连接数
   */
  getActiveConnections(): number {
    return this.connections.size
  }

  /**
   * 是否正在关闭
   */
  isShutting(): boolean {
    return this.isShuttingDown
  }
}

/**
 * 创建优雅关闭管理器
 */
export function createGracefulShutdown(options: ShutdownOptions): GracefulShutdown {
  return new GracefulShutdown(options)
}

/**
 * 简单的关闭处理（用于简单场景）
 */
export function setupSimpleShutdown(cleanup?: () => Promise<void>) {
  const signals = ['SIGTERM', 'SIGINT', 'SIGHUP']

  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`\n收到 ${signal}，正在关闭...`)

      if (cleanup) {
        try {
          await cleanup()
        } catch (error) {
          console.error('清理失败:', error)
        }
      }

      process.exit(0)
    })
  }
}