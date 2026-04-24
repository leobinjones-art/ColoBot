/**
 * SOP Prompts Full 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

describe('SOP Prompts Full', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SOP_PROMPTS', () => {
    it('should have all prompts', async () => {
      const { SOP_PROMPTS } = await import('../config/sop-prompts.js');

      expect(SOP_PROMPTS.taskAnalysis).toBeDefined();
      expect(SOP_PROMPTS.stepGuidance).toBeDefined();
      expect(SOP_PROMPTS.summarizeSubAgent).toBeDefined();
      expect(SOP_PROMPTS.reviewStep).toBeDefined();
      expect(SOP_PROMPTS.finalOutput).toBeDefined();
    });

    it('should have placeholders', async () => {
      const { SOP_PROMPTS } = await import('../config/sop-prompts.js');

      expect(SOP_PROMPTS.taskAnalysis).toContain('{userMessage}');
      expect(SOP_PROMPTS.stepGuidance).toContain('{taskName}');
    });
  });

  describe('getSopPrompt', () => {
    it('should return prompt by name', async () => {
      const { getSopPrompt } = await import('../config/sop-prompts.js');

      const prompt = getSopPrompt('taskAnalysis');
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
    });

    it('should return stepGuidance prompt', async () => {
      const { getSopPrompt } = await import('../config/sop-prompts.js');

      const prompt = getSopPrompt('stepGuidance');
      expect(prompt).toContain('步骤');
    });
  });

  describe('fillPrompt', () => {
    it('should fill placeholders', async () => {
      const { fillPrompt } = await import('../config/sop-prompts.js');

      const template = 'Hello {name}!';
      const filled = fillPrompt(template, { name: 'World' });

      expect(filled).toBe('Hello World!');
    });

    it('should handle multiple placeholders', async () => {
      const { fillPrompt } = await import('../config/sop-prompts.js');

      const template = '{greeting} {name}!';
      const filled = fillPrompt(template, { greeting: 'Hello', name: 'World' });

      expect(filled).toBe('Hello World!');
    });

    it('should handle missing placeholders', async () => {
      const { fillPrompt } = await import('../config/sop-prompts.js');

      const template = 'Hello {name}!';
      const filled = fillPrompt(template, {});

      expect(filled).toBe('Hello !');
    });
  });

  describe('getSopPromptAsync', () => {
    it('should return prompt', async () => {
      const { getSopPromptAsync } = await import('../config/sop-prompts.js');

      const prompt = await getSopPromptAsync('taskAnalysis');
      expect(prompt).toBeDefined();
    });
  });

  describe('getAllSopPrompts', () => {
    it('should return all prompts', async () => {
      const { getAllSopPrompts } = await import('../config/sop-prompts.js');

      const prompts = await getAllSopPrompts();
      expect(prompts.taskAnalysis).toBeDefined();
      expect(prompts.stepGuidance).toBeDefined();
    });
  });
});