/**
 * Skill Evolution 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

import { query, queryOne } from '../memory/db.js';
import {
  detectPatterns,
  generateSkillMarkdown,
  writePendingSkill,
  listPendingSkills,
  approveSkill,
  rejectSkill,
} from '../agent-runtime/skill-evolution.js';

describe('Skill Evolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectPatterns', () => {
    it('should return null for empty tool sequence', async () => {
      const result = await detectPatterns('agent-1', 'Agent', [], []);
      expect(result).toBeNull();
    });

    it('should return null for low confidence', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);
      const result = await detectPatterns('agent-1', 'Agent', [], ['tool1']);
      expect(result).toBeNull();
    });

    it('should detect pattern with sufficient tools', async () => {
      vi.mocked(query).mockResolvedValueOnce([]);

      const result = await detectPatterns(
        'agent-1',
        'Agent',
        [{ role: 'user', content: 'test' }],
        ['tool1', 'tool2', 'tool3', 'tool4']
      );

      expect(result).not.toBeNull();
      expect(result?.toolSequence).toHaveLength(4);
    });

    it('should increase confidence for existing pattern', async () => {
      vi.mocked(query)
        .mockResolvedValueOnce([{
          id: 'pattern-1',
          agent_id: 'agent-1',
          agent_name: 'Agent',
          pattern: 'test',
          tool_sequence: '["tool1","tool2"]',
          conversation: '{}',
          confidence: 0.5,
          created_at: new Date(),
        }])
        .mockResolvedValueOnce([]);

      const result = await detectPatterns(
        'agent-1',
        'Agent',
        [],
        ['tool1', 'tool2']
      );

      expect(result).toBeNull(); // Returns null when updating existing
    });
  });

  describe('generateSkillMarkdown', () => {
    it('should generate skill markdown', () => {
      const markdown = generateSkillMarkdown(
        'TestSkill',
        '工具序列: tool1 → tool2',
        ['tool1', 'tool2']
      );

      expect(markdown).toContain('# TestSkill');
      expect(markdown).toContain('tool1');
      expect(markdown).toContain('tool2');
      expect(markdown).toContain('触发词');
    });

    it('should include usage scenario', () => {
      const markdown = generateSkillMarkdown(
        'MySkill',
        'Pattern description',
        ['toolA']
      );

      expect(markdown).toContain('Pattern description');
    });
  });

  describe('writePendingSkill', () => {
    it('should write pending skill', async () => {
      const id = await writePendingSkill(
        'agent-1',
        'TestSkill',
        '# TestSkill\nContent',
        ['tool1']
      );

      expect(id).toBeDefined();
      expect(query).toHaveBeenCalled();
    });
  });

  describe('listPendingSkills', () => {
    it('should list pending skills', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        {
          id: 'skill-1',
          skill_name: 'TestSkill',
          markdown_content: '# Test',
          trigger_words: '["testskill"]',
          created_at: new Date(),
        },
      ]);

      const skills = await listPendingSkills();

      expect(skills).toHaveLength(1);
      expect(skills[0].skill_name).toBe('TestSkill');
    });

    it('should parse trigger_words JSON', async () => {
      vi.mocked(query).mockResolvedValueOnce([
        {
          id: 'skill-1',
          skill_name: 'Test',
          markdown_content: '# Test',
          trigger_words: '["trigger1", "trigger2"]',
          created_at: new Date(),
        },
      ]);

      const skills = await listPendingSkills();

      expect(skills[0].trigger_words).toEqual(['trigger1', 'trigger2']);
    });
  });

  describe('approveSkill', () => {
    it('should throw if skill not found', async () => {
      vi.mocked(queryOne).mockResolvedValueOnce(null);

      await expect(approveSkill('NonExistent', 'user')).rejects.toThrow('Pending skill not found');
    });
  });

  describe('rejectSkill', () => {
    it('should update skill status to rejected', async () => {
      await rejectSkill('TestSkill', 'user', 'Not needed');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE pending_skills'),
        ['rejected', 'TestSkill', 'pending']
      );
    });
  });
});