/**
 * SOP V2 测试 - Extended
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock vector
vi.mock('../memory/vector.js', () => ({
  addMemory: vi.fn(async () => {}),
  searchMemory: vi.fn(async () => []),
}));

// Mock LLM
vi.mock('../llm/index.js', () => ({
  chat: vi.fn(async () => ({ content: '{"isAcademicTask":false,"taskType":"none","taskName":"","suggestedSteps":[],"informationComplete":false,"missingInfo":[]}' })),
}));

// Mock sub-agents
vi.mock('./sub-agents.js', () => ({
  spawnSubAgent: vi.fn(async () => 'sub-agent-1'),
  runSubAgentTask: vi.fn(async () => 'result'),
  destroySubAgent: vi.fn(async () => {}),
  getSubAgent: vi.fn(async () => null),
}));

// Mock config
vi.mock('../config/sop-prompts.js', () => ({
  getSopPrompt: vi.fn(() => 'Test prompt'),
  fillPrompt: vi.fn((t, v) => t),
}));

vi.mock('../config/sub-agents.js', () => ({
  getSubAgentConfig: vi.fn(() => null),
  getAllSubAgentConfigs: vi.fn(() => []),
  SubAgentType: {},
}));

import {
  aiAnalyzeTask,
  getActiveSopTask,
  listActiveSopTasks,
  getSopState,
  saveSopState,
  createSop,
  formatSopStatus,
  formatTaskBreakdown,
  detectExitIntent,
  detectPauseIntent,
  detectResumeIntent,
  detectConfirmation,
  detectListIntent,
  detectNewSopIntent,
} from '../agent-runtime/sop-v2.js';

describe('SOP V2 Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('aiAnalyzeTask', () => {
    it('should analyze user message', async () => {
      const result = await aiAnalyzeTask('帮我写一篇论文');

      expect(result).toHaveProperty('isAcademicTask');
      expect(result).toHaveProperty('taskType');
      expect(result).toHaveProperty('suggestedSteps');
    });

    it('should handle empty message', async () => {
      const result = await aiAnalyzeTask('');

      expect(result).toBeDefined();
    });
  });

  describe('getActiveSopTask', () => {
    it('should return null when no active task', async () => {
      const result = await getActiveSopTask('agent-1', 'session-1');
      expect(result).toBeNull();
    });
  });

  describe('listActiveSopTasks', () => {
    it('should return empty array when no tasks', async () => {
      const result = await listActiveSopTasks('agent-1');
      expect(result).toEqual([]);
    });
  });

  describe('getSopState', () => {
    it('should return null when no state', async () => {
      const result = await getSopState('agent-1', 'task-1');
      expect(result).toBeNull();
    });
  });

  describe('saveSopState', () => {
    it('should save state', async () => {
      const state = {
        taskId: 'task-1',
        sessionKey: 'session-1',
        agentId: 'agent-1',
        taskName: 'Test Task',
        taskSummary: 'Summary',
        steps: [],
        currentStep: 0,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await saveSopState(state);
      // Should not throw
    });
  });

  describe('createSop', () => {
    it('should create new SOP', async () => {
      const analysis = {
        isAcademicTask: true,
        taskType: 'thesis',
        taskName: 'Test Task',
        suggestedSteps: [
          { step: 1, name: 'Step 1', status: 'pending' as const, userData: null, subAgentResult: null, approved: false, reviewNote: null, subAgentId: null },
        ],
        informationComplete: true,
        missingInfo: [],
      };

      const result = await createSop('agent-1', 'session-1', analysis, 'Test message');

      expect(result).toHaveProperty('taskId');
      expect(result).toHaveProperty('taskName');
    });
  });

  describe('formatSopStatus', () => {
    it('should format SOP status', async () => {
      const state = {
        taskId: 'task-1',
        sessionKey: 'session-1',
        agentId: 'agent-1',
        taskName: 'Test Task',
        taskSummary: 'Summary',
        steps: [
          { step: 1, name: 'Step 1', status: 'done' as const, userData: null, subAgentResult: null, approved: true, reviewNote: null, subAgentId: null },
          { step: 2, name: 'Step 2', status: 'in_progress' as const, userData: null, subAgentResult: null, approved: false, reviewNote: null, subAgentId: null },
        ],
        currentStep: 2,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const formatted = await formatSopStatus(state);
      expect(typeof formatted).toBe('string');
    });
  });

  describe('formatTaskBreakdown', () => {
    it('should format task breakdown', async () => {
      const state = {
        taskId: 'task-1',
        sessionKey: 'session-1',
        agentId: 'agent-1',
        taskName: 'Test Task',
        taskSummary: 'Summary',
        steps: [
          { step: 1, name: 'Step 1', description: 'First step', status: 'pending' as const, userData: null, subAgentResult: null, approved: false, reviewNote: null, subAgentId: null },
          { step: 2, name: 'Step 2', description: 'Second step', status: 'pending' as const, userData: null, subAgentResult: null, approved: false, reviewNote: null, subAgentId: null },
        ],
        currentStep: 0,
        status: 'active' as const,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const formatted = await formatTaskBreakdown(state);
      expect(typeof formatted).toBe('string');
    });
  });

  describe('Intent Detection', () => {
    it('should detect exit intent', () => {
      expect(detectExitIntent('退出sop')).toBe(true);
      expect(detectExitIntent('cancel sop')).toBe(true);
      expect(detectExitIntent('exit sop')).toBe(true);
      expect(detectExitIntent('hello')).toBe(false);
    });

    it('should detect pause intent', () => {
      expect(detectPauseIntent('暂停sop')).toBe(true);
      expect(detectPauseIntent('stop')).toBe(true);
      expect(detectPauseIntent('continue')).toBe(false);
    });

    it('should detect resume intent', () => {
      expect(detectResumeIntent('继续sop')).toBe(true);
      expect(detectResumeIntent('resume sop')).toBe(true);
      expect(detectResumeIntent('resume')).toBe(true);
      expect(detectResumeIntent('stop')).toBe(false);
    });

    it('should detect confirmation', () => {
      expect(detectConfirmation('确认')).toBe(true);
      expect(detectConfirmation('是的')).toBe(true);
      expect(detectConfirmation('好的')).toBe(true);
      expect(detectConfirmation('no')).toBe(false);
    });

    it('should detect list intent', () => {
      expect(detectListIntent('sop列表')).toBe(true);
      expect(detectListIntent('查看sop')).toBe(true);
      expect(detectListIntent('我的sop')).toBe(true);
      expect(detectListIntent('show')).toBe(false);
    });

    it('should detect new SOP intent', () => {
      expect(detectNewSopIntent('新建sop')).toBe(true);
      expect(detectNewSopIntent('新sop')).toBe(true);
      expect(detectNewSopIntent('开始学术')).toBe(true);
      expect(detectNewSopIntent('hello')).toBe(false);
    });
  });
});