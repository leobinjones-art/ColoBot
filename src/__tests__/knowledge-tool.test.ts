/**
 * Knowledge Tool 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn((name, handler) => {
    (global as any).__registeredTools = (global as any).__registeredTools || {};
    (global as any).__registeredTools[name] = handler;
  }),
}));

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock embeddings
vi.mock('../memory/embeddings.js', () => ({
  embed: vi.fn(async () => ({ embedding: [0.1, 0.2, 0.3], model: 'mock' })),
}));

describe('Knowledge Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).__registeredTools = {};
  });

  describe('registerTools', () => {
    it('should register knowledge tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/knowledge.js');
      registerTools();

      expect((global as any).__registeredTools).toBeDefined();
    });
  });
});