/**
 * SOP Handler Extended 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock database
vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
  queryOne: vi.fn(async () => null),
}));

// Mock sop-v2
vi.mock('../agent-runtime/sop-v2.js', () => ({
  aiAnalyzeTask: vi.fn(async () => ({ isAcademicTask: false, taskType: 'none', complexity: 'low' })),
  getActiveSopTask: vi.fn(async () => null),
  listActiveSopTasks: vi.fn(async () => []),
  createSop: vi.fn(async () => ({ taskName: 'Test Task', status: 'created' })),
  getSopState: vi.fn(async () => null),
  saveSopState: vi.fn(async () => {}),
  generateStepGuidance: vi.fn(async () => 'Step guidance'),
  submitUserData: vi.fn(async () => ({ success: true })),
  aiReviewSubAgentOutput: vi.fn(async () => ({ approved: true })),
  approveAndAdvance: vi.fn(async () => ({ success: true })),
  rejectAndRetry: vi.fn(async () => ({ success: true })),
  confirmTaskBreakdown: vi.fn(async () => ({ success: true })),
  cancelSop: vi.fn(async () => {}),
  pauseSop: vi.fn(async () => {}),
  resumeSop: vi.fn(async () => {}),
  restartStep: vi.fn(async () => {}),
  detectExitIntent: vi.fn(() => false),
  detectPauseIntent: vi.fn(() => false),
  detectResumeIntent: vi.fn(() => false),
  detectRestartIntent: vi.fn(() => false),
  detectConfirmation: vi.fn(() => false),
  detectModification: vi.fn(() => null),
  detectListIntent: vi.fn(() => false),
  detectNewSopIntent: vi.fn(() => false),
  detectTaskSelection: vi.fn(() => null),
  detectResearchPurpose: vi.fn(() => null),
  formatSopStatus: vi.fn(() => 'Status'),
  formatTaskBreakdown: vi.fn(() => 'Breakdown'),
  formatSopList: vi.fn(() => 'List'),
  summarizeSubAgentResult: vi.fn(async () => 'Summary'),
  applyUserPreference: vi.fn(async (agentId, analysis) => analysis),
  recordPurposeSelection: vi.fn(async () => {}),
  recordModification: vi.fn(async () => {}),
  recordStepMetrics: vi.fn(async () => {}),
  generateOptimizationReport: vi.fn(async () => 'Optimization report'),
  generateFinalOutput: vi.fn(async () => ({ success: true, filePath: '/tmp/output.md' })),
  generateSopResponse: vi.fn(async () => 'Response'),
}));

describe('SOP Handler Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleSopFlow', () => {
    it('should handle optimization report request', async () => {
      const { handleSopFlow } = await import('../agent-runtime/sop-handler.js');
      const result = await handleSopFlow('sop优化报告', 'agent-1', 'session-1');

      expect(result).toBeDefined();
      expect(result.action).toBe('none');
    });

    it('should handle empty message', async () => {
      const { handleSopFlow } = await import('../agent-runtime/sop-handler.js');
      const result = await handleSopFlow('', 'agent-1', 'session-1');

      expect(result).toBeDefined();
    });
  });
});