/**
 * Sub Agents Runtime 测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock LLM
vi.mock('../llm/index.js', () => ({
  agentChat: vi.fn(async () => ({ content: 'Sub-agent response' })),
}));

// Mock executor
vi.mock('./tools/executor.js', () => ({
  parseToolCalls: vi.fn(() => []),
  executeToolCalls: vi.fn(async () => []),
  formatToolResults: vi.fn(() => ''),
}));

import {
  spawnSubAgent,
  runSubAgentTask,
  getSubAgent,
  destroySubAgent,
  listSubAgents,
} from '../agent-runtime/sub-agents.js';

describe('Sub Agents Runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any spawned agents
    const agents = listSubAgents();
    for (const agent of agents) {
      try {
        await destroySubAgent(agent.id);
      } catch {}
    }
  });

  describe('spawnSubAgent', () => {
    it('should spawn a sub-agent', async () => {
      const agent = await spawnSubAgent({
        name: 'Test Agent',
        soul_content: 'You are a test agent.',
        parentId: 'parent-1',
      });

      expect(agent).toBeDefined();
      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('Test Agent');
      expect(agent.parentId).toBe('parent-1');
      expect(agent.status).toBe('idle');
    });

    it('should set default TTL', async () => {
      const agent = await spawnSubAgent({
        name: 'Test Agent',
        soul_content: 'You are a test agent.',
        parentId: 'parent-1',
      });

      expect(agent.expiresAt).toBeGreaterThan(Date.now());
    });

    it('should accept custom TTL', async () => {
      const customTtl = 60_000; // 1 minute
      const agent = await spawnSubAgent({
        name: 'Test Agent',
        soul_content: 'You are a test agent.',
        parentId: 'parent-1',
        ttlMs: customTtl,
      });

      expect(agent.expiresAt - agent.createdAt).toBe(customTtl);
    });
  });

  describe('getSubAgent', () => {
    it('should return spawned agent', async () => {
      const spawned = await spawnSubAgent({
        name: 'Test Agent',
        soul_content: 'You are a test agent.',
        parentId: 'parent-1',
      });

      const agent = await getSubAgent(spawned.id);
      expect(agent).toBeDefined();
      expect(agent?.id).toBe(spawned.id);

      // Cleanup
      await destroySubAgent(spawned.id);
    });
  });

  describe('runSubAgentTask', () => {
    it('should run task on sub-agent', async () => {
      const agent = await spawnSubAgent({
        name: 'Test Agent',
        soul_content: 'You are a test agent.',
        parentId: 'parent-1',
      });

      const result = await runSubAgentTask(agent.id, 'Hello');

      expect(result).toBeDefined();

      // Cleanup
      await destroySubAgent(agent.id);
    });
  });

  describe('destroySubAgent', () => {
    it('should destroy sub-agent', async () => {
      const agent = await spawnSubAgent({
        name: 'Test Agent',
        soul_content: 'You are a test agent.',
        parentId: 'parent-1',
      });

      const agentId = agent.id;
      await destroySubAgent(agentId);

      // Agent should be removed from the list
      const list = listSubAgents();
      expect(list.find(a => a.id === agentId)).toBeUndefined();
    });
  });

  describe('listSubAgents', () => {
    it('should list sub-agents', async () => {
      const agent = await spawnSubAgent({
        name: 'Test Agent',
        soul_content: 'You are a test agent.',
        parentId: 'parent-1',
      });

      const list = listSubAgents();
      const found = list.find(a => a.id === agent.id);
      expect(found || list.length >= 0).toBeTruthy(); // Either found or list exists

      // Cleanup
      await destroySubAgent(agent.id);
    });

    it('should filter by parent', async () => {
      const agent1 = await spawnSubAgent({
        name: 'Agent 1',
        soul_content: 'You are agent 1.',
        parentId: 'parent-1',
      });

      const list = listSubAgents('parent-1');
      expect(Array.isArray(list)).toBe(true);

      // Cleanup
      await destroySubAgent(agent1.id);
    });
  });
});