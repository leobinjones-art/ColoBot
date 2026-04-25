/**
 * @colobot/types 测试
 */
import { describe, it, expect } from 'vitest';
import type { TextContent, LLMMessage, LLMOptions } from '../llm.js';
import type { SubAgentType, Skill } from '../agent.js';
import type { ToolCall, ToolContext } from '../tool.js';
import type { SopStep } from '../sop.js';
import type { EmbedResult } from '../memory.js';

describe('@colobot/types', () => {
  describe('LLM Types', () => {
    it('should define TextContent', () => {
      const text: TextContent = { type: 'text', text: 'hello' };
      expect(text.type).toBe('text');
      expect(text.text).toBe('hello');
    });

    it('should define LLMMessage', () => {
      const msg: LLMMessage = { role: 'user', content: 'test' };
      expect(msg.role).toBe('user');
    });

    it('should define LLMOptions', () => {
      const opts: LLMOptions = { model: 'gpt-4', temperature: 0.7 };
      expect(opts.model).toBe('gpt-4');
    });
  });

  describe('Agent Types', () => {
    it('should define SubAgentType', () => {
      const type: SubAgentType = 'search';
      expect(type).toBe('search');
    });

    it('should define Skill', () => {
      const skill: Skill = {
        id: '1',
        name: 'test',
        description: 'test skill',
        version: '1.0.0',
        tools: [],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      expect(skill.name).toBe('test');
    });
  });

  describe('Tool Types', () => {
    it('should define ToolCall', () => {
      const call: ToolCall = {
        id: '1',
        name: 'test',
        args: {},
        type: 'function',
        function: { name: 'test', arguments: '{}' },
      };
      expect(call.name).toBe('test');
    });

    it('should define ToolContext', () => {
      const ctx: ToolContext = { agentId: 'a1', sessionKey: 's1' };
      expect(ctx.agentId).toBe('a1');
    });
  });

  describe('SOP Types', () => {
    it('should define SopStep', () => {
      const step: SopStep = {
        id: '1',
        name: 'test',
        description: 'test step',
        type: 'analysis',
        status: 'pending',
      };
      expect(step.status).toBe('pending');
    });
  });

  describe('Memory Types', () => {
    it('should define EmbedResult', () => {
      const result: EmbedResult = {
        embedding: [0.1, 0.2, 0.3],
        model: 'text-embedding-3-small',
        tokens: 10,
      };
      expect(result.embedding).toHaveLength(3);
    });
  });
});