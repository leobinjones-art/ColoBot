/**
 * SOP V2 测试
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

import { aiAnalyzeTask } from '../agent-runtime/sop-v2.js';

describe('SOP V2', () => {
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
});