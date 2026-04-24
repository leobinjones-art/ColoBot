/**
 * Agent Registry 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

import { query, queryOne } from '../memory/db.js';
import { agentRegistry } from '../agents/registry.js';

describe('Agent Registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('should list all agents', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        { id: 'a1', name: 'Agent1', soul_content: '{}', memory_content: '', workspace_path: '/ws', primary_model_id: null, fallback_model_id: null, temperature: 0.7, max_tokens: 4096, context_window_size: 8000, max_tool_rounds: 10, system_prompt_override: null, status: 'idle', created_at: new Date(), updated_at: new Date() },
        { id: 'a2', name: 'Agent2', soul_content: '{}', memory_content: '', workspace_path: '/ws', primary_model_id: null, fallback_model_id: null, temperature: 0.7, max_tokens: 4096, context_window_size: 8000, max_tool_rounds: 10, system_prompt_override: null, status: 'idle', created_at: new Date(), updated_at: new Date() },
      ]);

      const agents = await agentRegistry.list();

      expect(agents).toHaveLength(2);
    });
  });

  describe('get', () => {
    it('should return agent by id', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'agent-1',
        name: 'TestAgent',
        soul_content: '{"role":"assistant"}',
        memory_content: '',
        workspace_path: '/workspace/TestAgent',
        primary_model_id: null,
        fallback_model_id: null,
        temperature: 0.7,
        max_tokens: 4096,
        context_window_size: 8000,
        max_tool_rounds: 10,
        system_prompt_override: null,
        status: 'idle',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const agent = await agentRegistry.get('agent-1');

      expect(agent).not.toBeNull();
      expect(agent?.name).toBe('TestAgent');
    });

    it('should return null if not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const agent = await agentRegistry.get('non-existent');

      expect(agent).toBeNull();
    });
  });

  describe('getByName', () => {
    it('should return agent by name', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'agent-1',
        name: 'ColoBot',
        soul_content: '{}',
        memory_content: '',
        workspace_path: '/ws',
        primary_model_id: null,
        fallback_model_id: null,
        temperature: 0.7,
        max_tokens: 4096,
        context_window_size: 8000,
        max_tool_rounds: 10,
        system_prompt_override: null,
        status: 'idle',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const agent = await agentRegistry.getByName('ColoBot');

      expect(agent?.name).toBe('ColoBot');
    });
  });

  describe('create', () => {
    it('should create new agent', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'new-agent',
        name: 'NewAgent',
        soul_content: '{"role":"NewAgent","personality":""}',
        memory_content: '',
        workspace_path: '/workspace/NewAgent',
        primary_model_id: null,
        fallback_model_id: null,
        temperature: 0.7,
        max_tokens: 4096,
        context_window_size: 8000,
        max_tool_rounds: 10,
        system_prompt_override: null,
        status: 'idle',
        created_at: new Date(),
        updated_at: new Date(),
      });

      const agent = await agentRegistry.create({ name: 'NewAgent' });

      expect(query).toHaveBeenCalled();
      expect(agent.name).toBe('NewAgent');
    });

    it('should use provided soul_content', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'new-agent',
        name: 'CustomAgent',
        soul_content: '{"role":"custom"}',
        memory_content: '',
        workspace_path: '/ws',
        primary_model_id: null,
        fallback_model_id: null,
        temperature: 0.7,
        max_tokens: 4096,
        context_window_size: 8000,
        max_tool_rounds: 10,
        system_prompt_override: null,
        status: 'idle',
        created_at: new Date(),
        updated_at: new Date(),
      });

      await agentRegistry.create({ name: 'CustomAgent', soul_content: '{"role":"custom"}' });

      expect(query).toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('should update agent settings', async () => {
      await agentRegistry.updateSettings('agent-1', { temperature: 0.5 });

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agents'),
        expect.arrayContaining([0.5, 'agent-1'])
      );
    });

    it('should handle multiple settings', async () => {
      await agentRegistry.updateSettings('agent-1', {
        temperature: 0.8,
        max_tokens: 8192,
        primary_model_id: 'gpt-4',
      });

      expect(query).toHaveBeenCalled();
    });

    it('should skip if no settings provided', async () => {
      await agentRegistry.updateSettings('agent-1', {});

      expect(query).not.toHaveBeenCalled();
    });
  });

  describe('updateSoul', () => {
    it('should update agent soul', async () => {
      await agentRegistry.updateSoul('agent-1', '{"role":"updated"}');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agents SET soul_content'),
        ['{"role":"updated"}', 'agent-1']
      );
    });
  });

  describe('setStatus', () => {
    it('should update agent status', async () => {
      await agentRegistry.setStatus('agent-1', 'active');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE agents SET status'),
        ['active', 'agent-1']
      );
    });
  });

  describe('delete', () => {
    it('should delete agent', async () => {
      await agentRegistry.delete('agent-1');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM agents'),
        ['agent-1']
      );
    });
  });

  describe('parseSoul', () => {
    it('should parse valid JSON soul', () => {
      const soul = agentRegistry.parseSoul('{"role":"assistant","rules":["be helpful"]}');

      expect(soul.role).toBe('assistant');
      expect(soul.rules).toEqual(['be helpful']);
    });

    it('should return empty object for invalid JSON', () => {
      const soul = agentRegistry.parseSoul('invalid json');

      expect(soul).toEqual({});
    });

    it('should return empty object for empty string', () => {
      const soul = agentRegistry.parseSoul('');

      expect(soul).toEqual({});
    });
  });
});