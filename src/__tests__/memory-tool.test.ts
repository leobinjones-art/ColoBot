/**
 * Memory Tool 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn(),
}));

// Mock vector
vi.mock('../memory/vector.js', () => ({
  addMemory: vi.fn(async () => {}),
  searchMemory: vi.fn(async () => []),
  listMemory: vi.fn(async () => []),
}));

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

describe('Memory Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('registerTools', () => {
    it('should register memory tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/memory.js');
      expect(() => registerTools()).not.toThrow();
    });
  });
});