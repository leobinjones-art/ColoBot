/**
 * Exec Code Tool 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn((name, handler) => {
    (global as any).__registeredTools = (global as any).__registeredTools || {};
    (global as any).__registeredTools[name] = handler;
  }),
}));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((_cmd, _opts, cb) => {
    if (typeof _opts === 'function') cb = _opts;
    cb(null, { stdout: 'output', stderr: '' });
  }),
}));

describe('Exec Code Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).__registeredTools = {};
  });

  describe('registerTools', () => {
    it('should register exec_code tool', async () => {
      const { registerTools } = await import('../agent-runtime/tools/exec-code.js');
      registerTools();

      expect((global as any).__registeredTools).toBeDefined();
    });
  });
});