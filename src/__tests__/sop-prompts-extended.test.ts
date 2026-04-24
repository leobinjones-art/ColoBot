/**
 * SOP Prompts Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

import {
  SOP_PROMPTS,
  getSopPrompt,
  fillPrompt,
  getSopPromptAsync,
  getAllSopPrompts,
} from '../config/sop-prompts.js';

describe('SOP Prompts Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('SOP_PROMPTS', () => {
    it('should have all required prompts', () => {
      expect(SOP_PROMPTS.taskAnalysis).toBeDefined();
      expect(SOP_PROMPTS.stepGuidance).toBeDefined();
      expect(SOP_PROMPTS.summarizeSubAgent).toBeDefined();
      expect(SOP_PROMPTS.reviewStep).toBeDefined();
      expect(SOP_PROMPTS.finalOutput).toBeDefined();
    });

    it('should have placeholders in prompts', () => {
      expect(SOP_PROMPTS.taskAnalysis).toContain('{userMessage}');
      expect(SOP_PROMPTS.stepGuidance).toContain('{taskName}');
      expect(SOP_PROMPTS.stepGuidance).toContain('{stepNumber}');
      expect(SOP_PROMPTS.summarizeSubAgent).toContain('{subAgentResult}');
    });
  });

  describe('getSopPrompt', () => {
    it('should return prompt by name', () => {
      const prompt = getSopPrompt('taskAnalysis');
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
    });

    it('should return stepGuidance prompt', () => {
      const prompt = getSopPrompt('stepGuidance');
      expect(prompt).toContain('步骤');
    });

    it('should return summarizeSubAgent prompt', () => {
      const prompt = getSopPrompt('summarizeSubAgent');
      expect(prompt).toContain('子Agent');
    });
  });

  describe('fillPrompt', () => {
    it('should fill placeholders in prompt', () => {
      const template = 'Hello {name}, welcome to {place}!';
      const filled = fillPrompt(template, { name: 'Alice', place: 'ColoBot' });

      expect(filled).toBe('Hello Alice, welcome to ColoBot!');
    });

    it('should handle missing placeholders', () => {
      const template = 'Hello {name}!';
      const filled = fillPrompt(template, {});

      expect(filled).toBe('Hello !');
    });

    it('should handle taskAnalysis prompt', () => {
      const prompt = getSopPrompt('taskAnalysis');
      const filled = fillPrompt(prompt, { userMessage: '帮我写一篇论文' });

      expect(filled).toContain('帮我写一篇论文');
    });

    it('should handle numeric values', () => {
      const template = 'Step {step} of {total}';
      const filled = fillPrompt(template, { step: 1, total: 10 });

      expect(filled).toBe('Step 1 of 10');
    });
  });

  describe('getSopPromptAsync', () => {
    it('should return prompt asynchronously', async () => {
      const prompt = await getSopPromptAsync('taskAnalysis');
      expect(prompt).toBeDefined();
      expect(typeof prompt).toBe('string');
    });
  });

  describe('getAllSopPrompts', () => {
    it('should return all prompts', async () => {
      const prompts = await getAllSopPrompts();

      expect(prompts.taskAnalysis).toBeDefined();
      expect(prompts.stepGuidance).toBeDefined();
      expect(prompts.summarizeSubAgent).toBeDefined();
      expect(prompts.reviewStep).toBeDefined();
      expect(prompts.finalOutput).toBeDefined();
    });

    it('should include source info', async () => {
      const prompts = await getAllSopPrompts();

      expect(prompts.taskAnalysis.value).toBeDefined();
      expect(['db', 'env', 'default']).toContain(prompts.taskAnalysis.source);
    });
  });
});