/**
 * Sub Agents Full 测试
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

describe('Sub Agents Full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
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

  describe('spawnSubAgent', () => {
    it('should spawn agent with minimal config', async () => {
      const { spawnSubAgent } = await import('../agent-runtime/sub-agents.js');
      const agent = await spawnSubAgent({
        name: 'Test Agent',
        soul_content: 'You are helpful.',
        parentId: 'parent-1',
      });

      expect(agent).toBeDefined();
      expect(agent.name).toBe('Test Agent');

      const { destroySubAgent } = await import('../agent-runtime/sub-agents.js');
      await destroySubAgent(agent.id);
    });

    it('should spawn agent with custom TTL', async () => {
      const { spawnSubAgent } = await import('../agent-runtime/sub-agents.js');
      const agent = await spawnSubAgent({
        name: 'Custom TTL Agent',
        soul_content: 'You are helpful.',
        parentId: 'parent-1',
        ttlMs: 30000,
      });

      expect(agent).toBeDefined();

      const { destroySubAgent } = await import('../agent-runtime/sub-agents.js');
      await destroySubAgent(agent.id);
    });
  });

  describe('listSubAgents', () => {
    it('should return array', async () => {
      const { listSubAgents } = await import('../agent-runtime/sub-agents.js');
      const agents = listSubAgents();

      expect(Array.isArray(agents)).toBe(true);
    });
  });

  describe('getSubAgent', () => {
    it('should return undefined for non-existent agent', async () => {
      const { getSubAgent } = await import('../agent-runtime/sub-agents.js');
      const agent = await getSubAgent('non-existent-id');

      expect(agent).toBeUndefined();
    });
  });
});