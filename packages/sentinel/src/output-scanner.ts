/**
 * 输出异步扫描
 *
 * 先放行输出，异步检测问题后撤回替换
 */

import type { Sentinel } from './index.js'

export interface OutputScanResult {
  original: string
  replaced: boolean
  replacement?: string
  reason?: string
}

export interface OutputScanConfig {
  enabled: boolean
  recallCallback?: (sessionId: string, original: string, replacement: string) => void
}

/**
 * 输出扫描器
 */
export class OutputScanner {
  private sentinel: Sentinel
  private config: OutputScanConfig
  private flaggedSessions: Set<string> = new Set()

  constructor(sentinel: Sentinel, config: OutputScanConfig = { enabled: true }) {
    this.sentinel = sentinel
    this.config = config
  }

  /**
   * 异步扫描输出
   *
   * @param response - 输出内容
   * @param sessionId - 会话 ID
   * @returns 原始输出（先放行），异步检测问题后触发回调
   */
  scanAsync(response: string, sessionId: string): string {
    if (!this.config.enabled) {
      return response
    }

    // 异步检测（不阻塞）
    queueMicrotask(() => {
      const result = this.sentinel.scanOutput(response)

      if (!result.pass) {
        // 标记为风险会话
        this.flaggedSessions.add(sessionId)

        // 触发撤回回调
        if (this.config.recallCallback) {
          const replacement = this.getReplacement(result.reason)
          this.config.recallCallback(sessionId, response, replacement)
        }
      }
    })

    // 先返回原始输出
    return response
  }

  /**
   * 同步扫描（阻塞）
   */
  scanSync(response: string): OutputScanResult {
    if (!this.config.enabled) {
      return { original: response, replaced: false }
    }

    const result = this.sentinel.scanOutput(response)

    if (!result.pass) {
      const replacement = this.getReplacement(result.reason)
      return {
        original: response,
        replaced: true,
        replacement,
        reason: result.reason,
      }
    }

    return { original: response, replaced: false }
  }

  /**
   * 检查会话是否被标记
   */
  isFlagged(sessionId: string): boolean {
    return this.flaggedSessions.has(sessionId)
  }

  /**
   * 清除标记
   */
  clearFlag(sessionId: string): void {
    this.flaggedSessions.delete(sessionId)
  }

  /**
   * 获取替换内容
   */
  private getReplacement(reason?: string): string {
    switch (reason) {
      case 'blocked_word':
        return '生成的内容包含敏感信息，已为您过滤。'
      case 'blocked_pattern':
        return '生成的内容需要调整，请重新提问。'
      case 'too_long':
        return '回复内容过长，已为您截断。'
      default:
        return '生成的内容需要调整，请稍后重试。'
    }
  }
}
