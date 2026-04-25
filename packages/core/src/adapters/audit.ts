/**
 * 审计日志实现
 */

import type { AuditEntry } from '../runtime/types.js';
import type { AuditLogger } from '../runtime/types.js';

export interface InMemoryAuditConfig {
  maxEntries?: number;
}

export class InMemoryAudit implements AuditLogger {
  private entries: AuditEntry[] = [];
  private maxEntries: number;

  constructor(config: InMemoryAuditConfig = {}) {
    this.maxEntries = config.maxEntries || 1000;
  }

  async write(entry: AuditEntry): Promise<void> {
    this.entries.push({
      ...entry,
      action: entry.action,
    });

    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }
  }

  getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
  }
}

/**
 * 控制台审计 - 输出到控制台
 */
export class ConsoleAudit implements AuditLogger {
  async write(entry: AuditEntry): Promise<void> {
    const timestamp = new Date().toISOString();
    const level = entry.result === 'success' ? 'INFO' : entry.result === 'failure' ? 'ERROR' : 'WARN';

    console.log(`[${timestamp}] [${level}] ${entry.actorType}:${entry.actorId} ${entry.action} ${entry.targetType}:${entry.targetId} - ${entry.result}`);

    if (entry.errorMessage) {
      console.log(`  Error: ${entry.errorMessage}`);
    }

    if (entry.detail) {
      console.log(`  Detail:`, entry.detail);
    }
  }
}
