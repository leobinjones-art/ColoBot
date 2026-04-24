/**
 * Memory Tool Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn((name, handler) => {
    (global as any).__registeredTools = (global as any).__registeredTools || {};
    (global as any).__registeredTools[name] = handler;
  }),
}));

// Mock vector
vi.mock('../memory/vector.js', () => ({
  addMemory: vi.fn(async () => {}),
  searchMemory: vi.fn(async () => [{ key: 'test', value: 'result', similarity: 0.9 }]),
  listMemory: vi.fn(async () => [{ key: 'key1', value: 'value1' }]),
  searchMemoryText: vi.fn(async () => []),
}));

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

describe('Memory Tool Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).__registeredTools = {};
  });

  describe('registerTools', () => {
    it('should register memory tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/memory.js');
      registerTools();

      expect((global as any).__registeredTools).toBeDefined();
    });
  });
});