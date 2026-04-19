import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isCommercialDocument,
  isDangerousTool,
  recordToolHit,
  listRules,
  deleteRule,
  seedDefaultRules,
} from '../agent-runtime/approval-rules.js';

vi.mock('../memory/db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

describe('approval-rules', () => {
  let mockDb: { query: ReturnType<typeof vi.fn>; queryOne: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    const db = await import('../memory/db.js');
    mockDb = { query: db.query, queryOne: db.queryOne };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isCommercialDocument', () => {
    const cases: [string, boolean][] = [
      ['这是一份采购合同', true],
      ['NDA保密协议模板', true],
      ['contract agreement terms', true],
      ['Letter of Intent', true],
      ['MoU between two parties', true],
      ['帮我写个请假条', false],
      ['今天晚饭吃什么', false],
      ['帮我分析一下这个代码', false],
      ['合同编号是12345', true],
      ['请帮我起草一份保密协议', true],
      ['代理授权书', true],
      ['租赁合同模板', true],
      ['投资建议', false],
    ];

    cases.forEach(([input, expected]) => {
      it(`"${input}" → ${expected}`, () => {
        expect(isCommercialDocument(input)).toBe(expected);
      });
    });
  });

  describe('isDangerousTool', () => {
    it('returns true for dangerous tool names', async () => {
      mockDb.query.mockResolvedValue([
        { pattern_type: 'keyword', pattern: 'delete', name: 'delete_tool', enabled: true, priority: 10 },
      ]);
      expect(await isDangerousTool('delete_agent')).toBe(true);
      expect(await isDangerousTool('delete_file')).toBe(true);
    });

    it('returns false for safe tool names', async () => {
      mockDb.query.mockResolvedValue([
        { pattern_type: 'keyword', pattern: 'delete', name: 'delete_tool', enabled: true, priority: 10 },
      ]);
      expect(await isDangerousTool('read_file')).toBe(false);
      expect(await isDangerousTool('send_message')).toBe(false);
    });

    it('returns true for regex matching dangerous patterns', async () => {
      mockDb.query.mockResolvedValue([
        { pattern_type: 'regex', pattern: 'delete_.*', name: 'delete_pattern', enabled: true, priority: 10 },
      ]);
      expect(await isDangerousTool('delete_anything')).toBe(true);
    });

    it('returns false when no matching rules', async () => {
      mockDb.query.mockResolvedValue([]);
      expect(await isDangerousTool('list_tools')).toBe(false);
    });
  });

  describe('recordToolHit', () => {
    it('inserts a tool hit record', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await recordToolHit('send_message', '{}', 'rule-uuid');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO approval_rule_hits'),
        expect.arrayContaining(['rule-uuid'])
      );
    });

    it('inserts without rule_id when not provided', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await recordToolHit('send_message', '{}');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO approval_rule_hits'),
        expect.arrayContaining([null])
      );
    });
  });

  describe('listRules', () => {
    it('returns rules ordered by created_at desc', async () => {
      const mockRules = [
        { id: '1', name: 'Rule A', pattern: 'delete', pattern_type: 'keyword', action: 'reject', risk_level: 'high', enabled: true, priority: 10, description: '', user_approve_count: 0, user_reject_count: 0, auto_approve_threshold: 3, auto_reject_threshold: 3, confidence_decay_days: 14, last_decided_at: null },
        { id: '2', name: 'Rule B', pattern: 'send', pattern_type: 'keyword', action: 'require_approval', risk_level: 'medium', enabled: true, priority: 20, description: '', user_approve_count: 0, user_reject_count: 0, auto_approve_threshold: 3, auto_reject_threshold: 3, confidence_decay_days: 14, last_decided_at: null },
      ];
      mockDb.query.mockResolvedValue(mockRules);
      const rules = await listRules();
      expect(rules).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY created_at DESC'));
    });
  });

  describe('deleteRule', () => {
    it('deletes rule by id', async () => {
      mockDb.query.mockResolvedValueOnce([]);
      await deleteRule('rule-123');
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM approval_rules'),
        ['rule-123']
      );
    });
  });

  describe('seedDefaultRules', () => {
    it('does not seed if rules already exist', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ cnt: '5' });
      await seedDefaultRules();
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('seeds rules when table is empty', async () => {
      mockDb.queryOne.mockResolvedValueOnce({ cnt: '0' });
      mockDb.query.mockResolvedValue({});
      await seedDefaultRules();
      // 1 select + 18 inserts
      expect(mockDb.query.mock.calls.length).toBeGreaterThanOrEqual(18);
    });
  });
});
