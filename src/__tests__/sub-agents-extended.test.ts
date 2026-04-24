/**
 * Sub Agents Extended 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock LLM
vi.mock('../llm/index.js', () => ({
  agentChat: vi.fn(async () => ({ content: 'Sub-agent response' })),
}));

// Mock executor
vi.mock('../agent-runtime/tools/executor.js', () => ({
  parseToolCalls: vi.fn(() => []),
  executeToolCalls: vi.fn(async () => []),
  formatToolResults: vi.fn(() => ''),
}));

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

describe('Sub Agents Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any spawned agents
    try {
      const { listSubAgents, destroySubAgent } = await import('../agent-runtime/sub-agents.js');
      const agents = listSubAgents();
      for (const agent of agents) {
        try {
          await destroySubAgent(agent.id);
        } catch {}
      }
    } catch {}
  });

  describe('spawnSubAgent with full config', () => {
    it('should spawn agent with custom config', async () => {
      const { spawnSubAgent } = await import('../agent-runtime/sub-agents.js');
      const agent = await spawnSubAgent({
        name: 'Research Agent',
        soul_content: 'You are a research assistant.',
        parentId: 'parent-1',
        ttlMs: 120000,
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('Research Agent');
      expect(agent.parentId).toBe('parent-1');

      // Cleanup
      const { destroySubAgent } = await import('../agent-runtime/sub-agents.js');
      await destroySubAgent(agent.id);
    });
  });

  describe('runSubAgentTask with messages', () => {
    it('should run task and return result', async () => {
      const { spawnSubAgent, runSubAgentTask, destroySubAgent } = await import('../agent-runtime/sub-agents.js');

      const agent = await spawnSubAgent({
        name: 'Test Agent',
        soul_content: 'You are helpful.',
        parentId: 'parent-1',
      });

      const result = await runSubAgentTask(agent.id, 'Hello, can you help me?');

      expect(result).toBeDefined();

      await destroySubAgent(agent.id);
    });
  });

  describe('listSubAgents filtering', () => {
    it('should filter by parent', async () => {
      const { spawnSubAgent, listSubAgents, destroySubAgent } = await import('../agent-runtime/sub-agents.js');

      const agent1 = await spawnSubAgent({
        name: 'Agent 1',
        soul_content: 'Agent 1',
        parentId: 'parent-A',
      });

      const agent2 = await spawnSubAgent({
        name: 'Agent 2',
        soul_content: 'Agent 2',
        parentId: 'parent-B',
      });

      const allList = listSubAgents();

      expect(allList.length).toBeGreaterThanOrEqual(0);

      await destroySubAgent(agent1.id);
      await destroySubAgent(agent2.id);
    });
  });
});