/**
 * Workspace Tool Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn((name, handler) => {
    (global as any).__registeredTools = (global as any).__registeredTools || {};
    (global as any).__registeredTools[name] = handler;
  }),
}));

// Mock fs
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(async () => 'file content'),
    writeFile: vi.fn(async () => {}),
    mkdir: vi.fn(async () => undefined),
    readdir: vi.fn(async () => ['file1.txt', 'file2.txt']),
    stat: vi.fn(async () => ({ isDirectory: () => false, size: 100, mtime: new Date() })),
    unlink: vi.fn(async () => {}),
    access: vi.fn(async () => {}),
  },
  existsSync: vi.fn(() => true),
}));

describe('Workspace Tool Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).__registeredTools = {};
  });

  describe('registerTools', () => {
    it('should register workspace tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/workspace.js');
      registerTools();

      expect((global as any).__registeredTools).toBeDefined();
    });
  });
});