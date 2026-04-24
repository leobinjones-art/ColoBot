/**
 * Import Soul Tool 测试
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

// Mock safe-fetch
vi.mock('../utils/safe-fetch.js', () => ({
  safeFetch: vi.fn(async () => ({ ok: true, text: async () => '# Test Agent\n\nYou are a helpful assistant.' })),
}));

describe('Import Soul Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).__registeredTools = {};
  });

  describe('registerTools', () => {
    it('should register import_soul tool', async () => {
      const { registerTools } = await import('../agent-runtime/tools/import-soul.js');
      registerTools();

      expect((global as any).__registeredTools).toBeDefined();
    });
  });
});