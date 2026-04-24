/**
 * SOP Handler 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock sop-v2
vi.mock('./sop-v2.js', () => ({
  aiAnalyzeTask: vi.fn(async () => ({ isAcademicTask: false, taskType: 'none', taskName: '', suggestedSteps: [], informationComplete: false, missingInfo: [] })),
  getActiveSopTask: vi.fn(async () => null),
  listActiveSopTasks: vi.fn(async () => []),
  createSop: vi.fn(async () => ({ taskId: 'task-1', sessionKey: 'session-1', agentId: 'agent-1', taskName: 'Test', steps: [], currentStep: 0, status: 'active', createdAt: '', updatedAt: '' })),
  getSopState: vi.fn(async () => null),
  saveSopState: vi.fn(async () => {}),
  generateStepGuidance: vi.fn(async () => 'Guidance'),
  submitUserData: vi.fn(async () => ({ taskId: 'task-1' })),
  aiReviewSubAgentOutput: vi.fn(async () => ({ approved: true, reviewNote: 'OK' })),
  approveAndAdvance: vi.fn(async () => ({ taskId: 'task-1' })),
  rejectAndRetry: vi.fn(async () => ({ taskId: 'task-1' })),
  confirmTaskBreakdown: vi.fn(async () => ({ taskId: 'task-1' })),
  cancelSop: vi.fn(async () => {}),
  pauseSop: vi.fn(async () => {}),
  resumeSop: vi.fn(async () => {}),
  restartStep: vi.fn(async () => ({ taskId: 'task-1' })),
  detectExitIntent: vi.fn(() => false),
  detectPauseIntent: vi.fn(() => false),
  detectResumeIntent: vi.fn(() => false),
  detectRestartIntent: vi.fn(() => false),
  detectConfirmation: vi.fn(() => false),
  detectModification: vi.fn(() => false),
  detectListIntent: vi.fn(() => false),
  detectNewSopIntent: vi.fn(() => false),
  detectTaskSelection: vi.fn(() => null),
  detectResearchPurpose: vi.fn(() => null),
  formatSopStatus: vi.fn(() => 'Status'),
  formatTaskBreakdown: vi.fn(() => 'Breakdown'),
  formatSopList: vi.fn(() => 'List'),
  summarizeSubAgentResult: vi.fn(async () => 'Summary'),
  applyUserPreference: vi.fn(async () => {}),
  recordPurposeSelection: vi.fn(async () => {}),
  recordModification: vi.fn(async () => {}),
  recordStepMetrics: vi.fn(async () => {}),
  generateOptimizationReport: vi.fn(async () => 'Report'),
  generateFinalOutput: vi.fn(async () => 'Output'),
  generateSopResponse: vi.fn(async () => 'Response'),
}));

import { handleSopFlow } from '../agent-runtime/sop-handler.js';

describe('SOP Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSopFlow', () => {
    it('should handle new message', async () => {
      const result = await handleSopFlow('Hello', 'agent-1', 'session-1');

      expect(result).toHaveProperty('response');
      expect(result).toHaveProperty('action');
    });

    it('should handle empty message', async () => {
      const result = await handleSopFlow('', 'agent-1', 'session-1');

      expect(result).toHaveProperty('response');
    });
  });
});