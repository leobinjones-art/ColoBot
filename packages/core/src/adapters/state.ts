/**
 * 状态存储适配器
 */

export interface StateStore {
  save(namespace: string, key: string, state: unknown): Promise<void>;
  load(namespace: string, key: string): Promise<unknown | null>;
  list(namespace: string, filter?: { status?: string; limit?: number; offset?: number }): Promise<unknown[]>;
  delete(namespace: string, key: string): Promise<void>;
}

/**
 * 内存状态存储
 */
export class InMemoryStateStore implements StateStore {
  private store: Map<string, Map<string, unknown>> = new Map();

  private getNamespace(namespace: string): Map<string, unknown> {
    if (!this.store.has(namespace)) {
      this.store.set(namespace, new Map());
    }
    return this.store.get(namespace)!;
  }

  async save(namespace: string, key: string, state: unknown): Promise<void> {
    this.getNamespace(namespace).set(key, state);
  }

  async load(namespace: string, key: string): Promise<unknown | null> {
    return this.getNamespace(namespace).get(key) ?? null;
  }

  async list(namespace: string, filter?: { status?: string; limit?: number; offset?: number }): Promise<unknown[]> {
    const ns = this.getNamespace(namespace);
    const entries = Array.from(ns.values());
    const offset = filter?.offset || 0;
    const limit = filter?.limit || entries.length;
    return entries.slice(offset, offset + limit);
  }

  async delete(namespace: string, key: string): Promise<void> {
    this.getNamespace(namespace).delete(key);
  }
}
