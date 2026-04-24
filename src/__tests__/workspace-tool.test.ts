/**
 * Workspace Tool 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn(),
}));

// Mock fs
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(async () => 'file content'),
    writeFile: vi.fn(async () => {}),
    mkdir: vi.fn(async () => {}),
    readdir: vi.fn(async () => []),
    stat: vi.fn(async () => ({ isDirectory: () => false })),
    unlink: vi.fn(async () => {}),
  },
}));

describe('Workspace Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerTools', () => {
    it('should register workspace tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/workspace.js');
      expect(() => registerTools()).not.toThrow();
    });
  });
});