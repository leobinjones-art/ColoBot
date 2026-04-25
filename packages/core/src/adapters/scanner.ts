/**
 * 内容扫描器实现
 */

import type { ScanResult } from '../runtime/types.js';
import type { ContentScanner } from '../runtime/types.js';

export interface SimpleScannerConfig {
  blockedPatterns?: string[];
  blockedWords?: string[];
}

export class SimpleContentScanner implements ContentScanner {
  private blockedPatterns: RegExp[];
  private blockedWords: string[];

  constructor(config: SimpleScannerConfig = {}) {
    this.blockedPatterns = (config.blockedPatterns || []).map(p => new RegExp(p, 'gi'));
    this.blockedWords = config.blockedWords || [];
  }

  async scanInput(content: string): Promise<ScanResult> {
    // 检查阻止词
    const lowerContent = content.toLowerCase();
    for (const word of this.blockedWords) {
      if (lowerContent.includes(word.toLowerCase())) {
        return {
          safe: false,
          reason: `Blocked word detected: ${word}`,
          scanner: 'simple-word-filter',
        };
      }
    }

    // 检查阻止模式
    for (const pattern of this.blockedPatterns) {
      if (pattern.test(content)) {
        return {
          safe: false,
          reason: `Blocked pattern detected: ${pattern.source}`,
          scanner: 'simple-pattern-filter',
        };
      }
    }

    return { safe: true };
  }

  async scanOutput(content: string): Promise<ScanResult> {
    // 输出扫描 - 可以添加不同的规则
    return { safe: true };
  }
}

/**
 * 空扫描器 - 允许所有内容
 */
export class NoOpScanner implements ContentScanner {
  async scanInput(_content: string): Promise<ScanResult> {
    return { safe: true };
  }

  async scanOutput(_content: string): Promise<ScanResult> {
    return { safe: true };
  }
}
