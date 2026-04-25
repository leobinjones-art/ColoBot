/**
 * 子智能体系统测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  spawnSubAgent,
  getSubAgent,
  listSubAgents,
  destroySubAgent,
  setSubAgentStatus,
  touchSubAgent,
  isToolAllowed,
  getSubAgentWorkspacePath,
  runSubAgentTask,
  clearSubAgents,
  setGlobalAllowedTools,
  type SubAgentDeps,
} from '../subagents/index.js';

describe('SubAgent System', () => {
  beforeEach(() => {
    clearSubAgents();
    // 重置为默认工具
    setGlobalAllowedTools(['read_file', 'write_file', 'list_dir', 'web_search', 'python', 'http']);
  });

  describe('spawnSubAgent', () => {
    it('should spawn a sub agent', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: JSON.stringify({ role: '助手' }),
        parentId: 'parent-1',
      });

      expect(agent.id).toBeDefined();
      expect(agent.name).toBe('test-agent');
      expect(agent.parentId).toBe('parent-1');
      expect(agent.status).toBe('idle');
    });

    it('should use global allowed tools', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      });

      expect(agent.allowedTools).toContain('read_file');
      expect(agent.allowedTools).toContain('web_search');
    });

    it('should use custom allowed tools', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        allowedTools: ['custom_tool'],
      });

      expect(agent.allowedTools).toEqual(['custom_tool']);
    });

    it('should set TTL', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        ttlMs: 60000,
      });

      expect(agent.expiresAt - agent.createdAt).toBe(60000);
    });
  });

  describe('getSubAgent', () => {
    it('should get existing agent', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      });

      const found = getSubAgent(agent.id);
      expect(found).toBe(agent);
    });

    it('should return undefined for non-existing agent', () => {
      const found = getSubAgent('non-existing');
      expect(found).toBeUndefined();
    });
  });

  describe('listSubAgents', () => {
    it('should list agents by parent', () => {
      spawnSubAgent({ name: 'agent-1', soulContent: '{}', parentId: 'parent-1' });
      spawnSubAgent({ name: 'agent-2', soulContent: '{}', parentId: 'parent-1' });
      spawnSubAgent({ name: 'agent-3', soulContent: '{}', parentId: 'parent-2' });

      const list1 = listSubAgents('parent-1');
      const list2 = listSubAgents('parent-2');

      expect(list1).toHaveLength(2);
      expect(list2).toHaveLength(1);
    });
  });

  describe('destroySubAgent', () => {
    it('should destroy agent by parent', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      });

      const result = destroySubAgent(agent.id, 'parent-1');
      expect(result).toBe(true);
      expect(getSubAgent(agent.id)).toBeUndefined();
    });

    it('should not destroy agent by wrong parent', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      });

      const result = destroySubAgent(agent.id, 'wrong-parent');
      expect(result).toBe(false);
      expect(getSubAgent(agent.id)).toBeDefined();
    });
  });

  describe('setSubAgentStatus', () => {
    it('should update status', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      });

      setSubAgentStatus(agent.id, 'busy');
      expect(getSubAgent(agent.id)?.status).toBe('busy');
    });
  });

  describe('touchSubAgent', () => {
    it('should extend expiration', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        ttlMs: 1000, // 1秒 TTL
      });

      const oldExpiresAt = agent.expiresAt;
      // 延长 2 分钟
      const result = touchSubAgent(agent.id, 120000);

      expect(result).toBe(true);
      const updated = getSubAgent(agent.id);
      // 新的过期时间应该比旧的晚
      expect(updated?.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('isToolAllowed', () => {
    it('should check allowed tool', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        allowedTools: ['tool-a', 'tool-b'],
      });

      expect(isToolAllowed(agent.id, 'tool-a')).toBe(true);
      expect(isToolAllowed(agent.id, 'tool-c')).toBe(false);
    });
  });

  describe('getSubAgentWorkspacePath', () => {
    it('should return workspace path', () => {
      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        workspacePath: '/custom/workspace',
      });

      expect(getSubAgentWorkspacePath(agent.id)).toBe('/custom/workspace');
    });

    it('should return null for non-existing agent', () => {
      expect(getSubAgentWorkspacePath('non-existing')).toBeNull();
    });
  });

  describe('runSubAgentTask', () => {
    it('should run task successfully', async () => {
      const mockDeps: SubAgentDeps = {
        llm: {
          name: 'mock',
          chat: vi.fn(async () => ({ content: 'Task completed' })),
          chatStream: vi.fn(async function* () {}),
        },
        audit: {
          write: vi.fn(async () => {}),
        },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: JSON.stringify({ role: '助手' }),
        parentId: 'parent-1',
      });

      const result = await runSubAgentTask(agent, 'test task', 'parent-1', mockDeps);

      expect(result).toBe('Task completed');
      expect(getSubAgent(agent.id)?.status).toBe('done');
    });

    it('should throw on parent mismatch', async () => {
      const mockDeps: SubAgentDeps = {
        llm: {
          name: 'mock',
          chat: vi.fn(async () => ({ content: 'ok' })),
          chatStream: vi.fn(async function* () {}),
        },
        audit: {
          write: vi.fn(async () => {}),
        },
        parseTools: vi.fn(() => []),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
      });

      await expect(
        runSubAgentTask(agent, 'test task', 'wrong-parent', mockDeps)
      ).rejects.toThrow('Unauthorized');
    });

    it('should execute allowed tools', async () => {
      const toolDeps: SubAgentDeps = {
        llm: {
          name: 'mock',
          chat: vi.fn()
            .mockResolvedValueOnce({ content: 'use read_file tool' })
            .mockResolvedValueOnce({ content: 'Done' }),
          chatStream: vi.fn(async function* () {}),
        },
        audit: {
          write: vi.fn(async () => {}),
        },
        parseTools: vi.fn()
          .mockReturnValueOnce([{ name: 'read_file', args: { path: '/test' } }])
          .mockReturnValueOnce([]),
        executeTools: vi.fn(async () => [{ toolCallId: 'tc1', name: 'read_file', result: 'file content' }]),
        formatResults: vi.fn(() => 'Tool result: file content'),
      };

      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        allowedTools: ['read_file'],
      });

      await runSubAgentTask(agent, 'read file', 'parent-1', toolDeps);

      expect(toolDeps.executeTools).toHaveBeenCalled();
    });

    it('should block disallowed tools', async () => {
      const toolDeps: SubAgentDeps = {
        llm: {
          name: 'mock',
          chat: vi.fn()
            .mockResolvedValueOnce({ content: 'use delete_file tool' })
            .mockResolvedValueOnce({ content: 'Done' }),
          chatStream: vi.fn(async function* () {}),
        },
        audit: {
          write: vi.fn(async () => {}),
        },
        parseTools: vi.fn()
          .mockReturnValueOnce([{ name: 'delete_file', args: { path: '/test' } }])
          .mockReturnValueOnce([]),
        executeTools: vi.fn(async () => []),
        formatResults: vi.fn(() => ''),
      };

      const agent = spawnSubAgent({
        name: 'test-agent',
        soulContent: '{}',
        parentId: 'parent-1',
        allowedTools: ['read_file'],
      });

      await runSubAgentTask(agent, 'delete file', 'parent-1', toolDeps);

      // executeTools 应该只被调用一次（空数组），因为 delete_file 不在白名单
      // 检查 audit 是否记录了 tool.blocked
      expect(toolDeps.audit.write).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'tool.blocked',
          targetId: 'delete_file',
        })
      );
    });
  });

  describe('concurrency limits', () => {
    it('should limit total concurrent agents', () => {
      // 创建 10 个 busy 状态的 agent
      for (let i = 0; i < 10; i++) {
        const agent = spawnSubAgent({
          name: `agent-${i}`,
          soulContent: '{}',
          parentId: 'parent-1',
        });
        setSubAgentStatus(agent.id, 'busy');
      }

      // 第 11 个应该抛出错误
      expect(() => spawnSubAgent({
        name: 'agent-11',
        soulContent: '{}',
        parentId: 'parent-1',
      })).toThrow('并发已达上限');
    });
  });
});
