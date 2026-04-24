/**
 * Runtime 测试 - Extended
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all dependencies
vi.mock('../agents/registry.js', () => ({
  agentRegistry: {
    get: vi.fn(async () => ({ id: 'agent-1', name: 'Test', soul: {}, soul_content: '{}' })),
    parseSoul: vi.fn(() => ({ personality: 'Test' })),
  },
}));

vi.mock('../agents/session.js', () => ({
  sessionManager: {
    get: vi.fn(() => ({ messages: [] })),
    addMessage: vi.fn(),
    appendMessage: vi.fn(async () => {}),
    clear: vi.fn(),
    getHistory: vi.fn(async () => []),
  },
}));

vi.mock('../llm/index.js', () => ({
  agentChat: vi.fn(async () => ({ content: 'Response' })),
  agentChatStream: vi.fn(async function* () {
    yield { content: 'Hello', done: false };
    yield { content: '', done: true };
  }),
}));

vi.mock('./compression.js', () => ({
  compressMessages: vi.fn(async (msgs) => msgs),
  estimateMessagesTokens: vi.fn(() => 100),
}));

vi.mock('./tools/executor.js', () => ({
  parseToolCalls: vi.fn(() => []),
  executeToolCalls: vi.fn(async () => []),
  formatToolResults: vi.fn(() => ''),
  isToolAllowed: vi.fn(() => true),
}));

vi.mock('../memory/vector.js', () => ({
  hybridSearch: vi.fn(async () => []),
}));

vi.mock('../services/audit.js', () => ({
  writeAudit: vi.fn(async () => {}),
}));

vi.mock('./approval.js', () => ({
  approvalFlow: {
    create: vi.fn(async () => ({ id: 'approval-1' })),
    approve: vi.fn(async () => {}),
    reject: vi.fn(async () => {}),
    list: vi.fn(async () => []),
  },
  ApprovalActionType: {},
}));

vi.mock('./approval-rules.js', () => ({
  checkDangerousLevel: vi.fn(() => 'safe'),
  recordToolHit: vi.fn(),
}));

vi.mock('../memory/db.js', () => ({
  query: vi.fn(async () => []),
}));

vi.mock('../ws-push.js', () => ({
  pushWsResult: vi.fn(),
  pushWsChunk: vi.fn(),
  pushWsDone: vi.fn(),
}));

vi.mock('../content-policy/guard.js', () => ({
  scanInput: vi.fn(async () => ({ safe: true })),
  scanOutput: vi.fn(async () => ({ safe: true })),
}));

vi.mock('../content-policy/threat.js', () => ({
  detectThreat: vi.fn(() => ({ isThreat: false, type: null })),
  buildUninstallConfirmPrompt: vi.fn(() => 'Confirm'),
}));

vi.mock('./sop-handler.js', () => ({
  handleSopFlow: vi.fn(async () => ({ response: 'SOP Response', state: null, action: 'none' })),
  shouldTriggerSop: vi.fn(() => false),
}));

vi.mock('./sop-v2.js', () => ({
  getSopState: vi.fn(async () => null),
}));

vi.mock('./chat-commands.js', () => ({
  parseCommand: vi.fn(() => null),
  executeCommand: vi.fn(async () => null),
}));

vi.mock('../services/user-profile.js', () => ({
  getUserProfile: vi.fn(async () => null),
  evolveProfileFromConversation: vi.fn(async () => {}),
}));

describe('Runtime Extended', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runAgent', () => {
    it('should handle basic chat', async () => {
      const { runAgent } = await import('../agent-runtime/runtime.js');
      const result = await runAgent({
        agentId: 'agent-1',
        sessionKey: 'session-1',
        userMessage: 'Hello',
      });

      expect(result).toHaveProperty('response');
    });
  });
});