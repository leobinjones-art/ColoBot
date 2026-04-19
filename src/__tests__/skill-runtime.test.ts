import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listSkills, getSkillByName, matchesTrigger, executeSkill } from '../agent-runtime/skill-runtime.js';
import { query, queryOne } from '../memory/db.js';

// Mock the database module
vi.mock('../memory/db.js', () => ({
  query: vi.fn(),
  queryOne: vi.fn(),
}));

// Mock LLM module
vi.mock('../llm/index.js', () => ({
  agentChat: vi.fn(),
}));

// Mock executor module
vi.mock('../agent-runtime/tools/executor.js', () => ({
  parseToolCalls: vi.fn(),
  executeToolCalls: vi.fn(),
  formatToolResults: vi.fn(),
}));

describe('skill-runtime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('listSkills', () => {
    it('should return empty array when no skills exist', async () => {
      (query as any).mockResolvedValue([]);

      const result = await listSkills();

      expect(result).toEqual([]);
      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM skills WHERE enabled = true ORDER BY name'
      );
    });

    it('should return parsed skills', async () => {
      const mockRows = [
        {
          id: 'skill-1',
          name: 'Test Skill',
          description: 'A test skill',
          markdown_content: '# Test Skill\n\nThis is a test skill.',
          trigger_words: '["test", "skill"]',
          trigger_config: '{}',
          enabled: true,
        },
      ];

      (query as any).mockResolvedValue(mockRows);

      const result = await listSkills();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('skill-1');
      expect(result[0].name).toBe('Test Skill');
      expect(result[0].trigger_words).toEqual(['test', 'skill']);
    });

    it('should handle trigger_words as array', async () => {
      const mockRows = [
        {
          id: 'skill-1',
          name: 'Test Skill',
          description: 'A test skill',
          markdown_content: '# Test Skill',
          trigger_words: ['test', 'skill'], // Already an array
          trigger_config: {},
          enabled: true,
        },
      ];

      (query as any).mockResolvedValue(mockRows);

      const result = await listSkills();

      expect(result[0].trigger_words).toEqual(['test', 'skill']);
    });
  });

  describe('getSkillByName', () => {
    it('should return null when skill not found', async () => {
      (queryOne as any).mockResolvedValue(null);

      const result = await getSkillByName('NonExistent');

      expect(result).toBeNull();
      expect(queryOne).toHaveBeenCalledWith(
        'SELECT * FROM skills WHERE name = $1',
        ['NonExistent']
      );
    });

    it('should return parsed skill when found', async () => {
      const mockRow = {
        id: 'skill-1',
        name: 'Test Skill',
        description: 'A test skill',
        markdown_content: '# Test Skill',
        trigger_words: '["test", "skill"]',
        trigger_config: '{}',
        enabled: true,
      };

      (queryOne as any).mockResolvedValue(mockRow);

      const result = await getSkillByName('Test Skill');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('skill-1');
      expect(result!.name).toBe('Test Skill');
    });
  });

  describe('matchesTrigger', () => {
    it('should return true when message contains trigger word', () => {
      const skill = {
        id: 'skill-1',
        name: 'Test Skill',
        description: null,
        markdown_content: '',
        trigger_words: ['help', 'assist'],
        trigger_config: {},
        enabled: true,
      };

      expect(matchesTrigger(skill, 'Can you help me?')).toBe(true);
      expect(matchesTrigger(skill, 'I need assistance')).toBe(true);
    });

    it('should return false when message does not contain trigger word', () => {
      const skill = {
        id: 'skill-1',
        name: 'Test Skill',
        description: null,
        markdown_content: '',
        trigger_words: ['help', 'assist'],
        trigger_config: {},
        enabled: true,
      };

      expect(matchesTrigger(skill, 'Hello world')).toBe(false);
      expect(matchesTrigger(skill, 'Good morning')).toBe(false);
    });

    it('should be case insensitive', () => {
      const skill = {
        id: 'skill-1',
        name: 'Test Skill',
        description: null,
        markdown_content: '',
        trigger_words: ['HELP', 'Assist'],
        trigger_config: {},
        enabled: true,
      };

      expect(matchesTrigger(skill, 'can you HELP me?')).toBe(true);
      expect(matchesTrigger(skill, 'I need assistance')).toBe(true);
      expect(matchesTrigger(skill, 'Help is on the way')).toBe(true);
    });
  });

  describe('executeSkill', () => {
    it('should execute skill without tool sequence', async () => {
      const skill = {
        id: 'skill-1',
        name: 'Test Skill',
        description: 'A test skill',
        markdown_content: '# Test Skill\n\nThis is a test skill.',
        trigger_words: ['test'],
        trigger_config: {},
        enabled: true,
      };

      const context = {
        sessionKey: 'session-123',
        userMessage: 'Test message',
      };

      // Mock LLM response
      const { agentChat } = await import('../llm/index.js');
      (agentChat as any).mockResolvedValue({
        content: 'Skill executed successfully',
      });

      const result = await executeSkill(skill, 'agent-123', context);

      expect(result).toBe('Skill executed successfully');
      expect(agentChat).toHaveBeenCalledWith(
        { personality: skill.markdown_content },
        [{ role: 'user', content: 'Test message' }],
        {}
      );
    });

    it('should execute skill with tool sequence', async () => {
      const skill = {
        id: 'skill-1',
        name: 'Test Skill',
        description: 'A test skill',
        markdown_content: '# Test Skill\n\n## 执行工具序列\n- test_tool',
        trigger_words: ['test'],
        trigger_config: {},
        enabled: true,
      };

      const context = {
        sessionKey: 'session-123',
        userMessage: 'Test message',
      };

      // Mock LLM response
      const { agentChat } = await import('../llm/index.js');
      (agentChat as any).mockResolvedValue({
        content: 'Skill with tools executed',
      });

      // Mock executor functions
      const { parseToolCalls } = await import('../agent-runtime/tools/executor.js');
      (parseToolCalls as any).mockReturnValue([]);

      const result = await executeSkill(skill, 'agent-123', context);

      expect(result).toBe('Skill with tools executed');
    });

    it('should handle empty skill content', async () => {
      const skill = {
        id: 'skill-1',
        name: 'Empty Skill',
        description: null,
        markdown_content: '',
        trigger_words: ['empty'],
        trigger_config: {},
        enabled: true,
      };

      const context = {
        sessionKey: 'session-123',
        userMessage: 'Test message',
      };

      const { agentChat } = await import('../llm/index.js');
      (agentChat as any).mockResolvedValue({
        content: 'Response from empty skill',
      });

      const result = await executeSkill(skill, 'agent-123', context);

      expect(result).toBe('Response from empty skill');
    });
  });
});