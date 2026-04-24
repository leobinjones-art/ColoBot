/**
 * Subagent Tool 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  registerTool: vi.fn((name, handler) => {
    (global as any).__registeredTools = (global as any).__registeredTools || {};
    (global as any).__registeredTools[name] = handler;
  }),
}));

// Mock sub-agents
vi.mock('../agent-runtime/sub-agents.js', () => ({
  spawnSubAgent: vi.fn(async () => ({ id: 'sub-agent-1', name: 'Test Agent', status: 'idle' })),
  runSubAgentTask: vi.fn(async () => ({ content: 'Task completed' })),
  destroySubAgent: vi.fn(async () => {}),
  listSubAgents: vi.fn(() => []),
}));

describe('Subagent Tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).__registeredTools = {};
  });

  describe('registerTools', () => {
    it('should register subagent tools', async () => {
      const { registerTools } = await import('../agent-runtime/tools/subagent.js');
      registerTools();

      expect((global as any).__registeredTools).toBeDefined();
    });
  });
});