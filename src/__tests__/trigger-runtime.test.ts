/**
 * Trigger Runtime 模块测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock skill runtime
vi.mock('../agent-runtime/skill-runtime.js', () => ({
  executeSkill: vi.fn(async () => {}),
}));

import { query, queryOne } from '../memory/db.js';
import { executeSkill } from '../agent-runtime/skill-runtime.js';
import {
  createTrigger,
  stopTrigger,
  fireWebhook,
  fireConditionTrigger,
} from '../agent-runtime/trigger-runtime.js';

describe('Trigger Runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createTrigger', () => {
    it('should create interval trigger', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      const trigger = await createTrigger('agent-1', 'skill-1', 'interval', { interval_ms: 60000 });

      expect(trigger.id).toBeDefined();
      expect(trigger.type).toBe('interval');
      expect(trigger.active).toBe(true);
      expect(trigger.next_fire_at).not.toBeNull();
    });

    it('should create cron trigger', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      const trigger = await createTrigger('agent-1', 'skill-1', 'cron', { cron: '0 9 * * *' });

      expect(trigger.id).toBeDefined();
      expect(trigger.type).toBe('cron');
      expect(trigger.next_fire_at).not.toBeNull();
    });

    it('should create webhook trigger without next_fire_at', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      const trigger = await createTrigger('agent-1', 'skill-1', 'webhook', {});

      expect(trigger.id).toBeDefined();
      expect(trigger.type).toBe('webhook');
      expect(trigger.next_fire_at).toBeNull();
    });
  });

  describe('stopTrigger', () => {
    it('should stop trigger and update database', async () => {
      await stopTrigger('trigger-1');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE triggers SET active = false'),
        ['trigger-1']
      );
    });
  });

  describe('fireWebhook', () => {
    it('should fire webhook trigger', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'trigger-1',
        agent_id: 'agent-1',
        skill_id: 'skill-1',
        type: 'webhook',
        config: {},
        active: true,
        last_fired_at: null,
        next_fire_at: null,
      });
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'skill-1',
        name: 'Test Skill',
        markdown_content: 'content',
        trigger_words: [],
        enabled: true,
      });

      await fireWebhook('trigger-1', { test: true });

      expect(executeSkill).toHaveBeenCalled();
    });

    it('should throw if trigger not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      await expect(fireWebhook('non-existent', {})).rejects.toThrow('Webhook trigger not found or inactive');
    });

    it('should throw if trigger inactive', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'trigger-1',
        active: false,
      });

      await expect(fireWebhook('trigger-1', {})).rejects.toThrow('Webhook trigger not found or inactive');
    });
  });

  describe('fireConditionTrigger', () => {
    it('should fire when condition met', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'trigger-1',
        agent_id: 'agent-1',
        skill_id: 'skill-1',
        type: 'condition',
        config: { condition: { field: 'price', operator: 'gt', value: 100 } },
        active: true,
        last_fired_at: null,
        next_fire_at: null,
      });
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'skill-1',
        name: 'Test Skill',
        markdown_content: 'content',
        trigger_words: [],
        enabled: true,
      });

      const result = await fireConditionTrigger('trigger-1', { price: 150 });

      expect(result.triggered).toBe(true);
    });

    it('should not fire when condition not met', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'trigger-1',
        agent_id: 'agent-1',
        skill_id: 'skill-1',
        type: 'condition',
        config: { condition: { field: 'price', operator: 'gt', value: 100 } },
        active: true,
        last_fired_at: null,
        next_fire_at: null,
      });

      const result = await fireConditionTrigger('trigger-1', { price: 50 });

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('Condition not met');
    });

    it('should handle AND conditions', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'trigger-1',
        agent_id: 'agent-1',
        skill_id: 'skill-1',
        type: 'condition',
        config: {
          condition: {
            and: [
              { field: 'status', operator: 'eq', value: 'active' },
              { field: 'count', operator: 'gt', value: 10 },
            ],
          },
        },
        active: true,
        last_fired_at: null,
        next_fire_at: null,
      });
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'skill-1',
        name: 'Test Skill',
        markdown_content: 'content',
        trigger_words: [],
        enabled: true,
      });

      const result = await fireConditionTrigger('trigger-1', { status: 'active', count: 15 });

      expect(result.triggered).toBe(true);
    });

    it('should handle OR conditions', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'trigger-1',
        agent_id: 'agent-1',
        skill_id: 'skill-1',
        type: 'condition',
        config: {
          condition: {
            or: [
              { field: 'role', operator: 'eq', value: 'admin' },
              { field: 'role', operator: 'eq', value: 'superuser' },
            ],
          },
        },
        active: true,
        last_fired_at: null,
        next_fire_at: null,
      });
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'skill-1',
        name: 'Test Skill',
        markdown_content: 'content',
        trigger_words: [],
        enabled: true,
      });

      const result = await fireConditionTrigger('trigger-1', { role: 'admin' });

      expect(result.triggered).toBe(true);
    });

    it('should handle NOT conditions', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'trigger-1',
        agent_id: 'agent-1',
        skill_id: 'skill-1',
        type: 'condition',
        config: {
          condition: {
            not: { field: 'blocked', operator: 'eq', value: true },
          },
        },
        active: true,
        last_fired_at: null,
        next_fire_at: null,
      });
      vi.mocked(queryOne).mockResolvedValueOnce({
        id: 'skill-1',
        name: 'Test Skill',
        markdown_content: 'content',
        trigger_words: [],
        enabled: true,
      });

      const result = await fireConditionTrigger('trigger-1', { blocked: false });

      expect(result.triggered).toBe(true);
    });

    it('should return not triggered for inactive trigger', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      const result = await fireConditionTrigger('non-existent', {});

      expect(result.triggered).toBe(false);
      expect(result.reason).toBe('Trigger not found or inactive');
    });
  });
});
