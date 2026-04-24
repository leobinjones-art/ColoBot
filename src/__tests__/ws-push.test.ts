/**
 * WebSocket Push 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ws module with OPEN constant
const WS_OPEN = 1;
vi.mock('ws', () => ({
  WebSocket: { OPEN: 1 },
  default: { OPEN: 1 },
}));

// Import after mock
import {
  setWsClients,
  pushWsResult,
  pushWsChunk,
  pushWsDone,
  pushWsApproval,
} from '../ws-push.js';

describe('WebSocket Push', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setWsClients(null as any);
  });

  describe('setWsClients', () => {
    it('should set ws clients map', () => {
      const clients = new Map();
      setWsClients(clients);
      // Should not throw
    });
  });

  describe('pushWsResult', () => {
    it('should do nothing if no clients', () => {
      pushWsResult('agent-1', 'session-1', { test: true });
      // Should not throw
    });

    it('should send result to connected client', () => {
      const mockWs = {
        readyState: WS_OPEN,
        OPEN: WS_OPEN,
        send: vi.fn(),
      };
      const clients = new Map();
      clients.set('agent-1:session-1', mockWs as any);
      setWsClients(clients);

      pushWsResult('agent-1', 'session-1', { response: 'test' });

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.type).toBe('response');
    });

    it('should skip if client not found', () => {
      const mockWs = {
        readyState: WS_OPEN,
        OPEN: WS_OPEN,
        send: vi.fn(),
      };
      const clients = new Map();
      clients.set('other:session', mockWs as any);
      setWsClients(clients);

      pushWsResult('agent-1', 'session-1', {});

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should skip if not OPEN', () => {
      const mockWs = {
        readyState: 0, // CONNECTING
        OPEN: WS_OPEN,
        send: vi.fn(),
      };
      const clients = new Map();
      clients.set('agent-1:session-1', mockWs as any);
      setWsClients(clients);

      pushWsResult('agent-1', 'session-1', {});

      expect(mockWs.send).not.toHaveBeenCalled();
    });

    it('should handle send error', () => {
      const mockWs = {
        readyState: WS_OPEN,
        OPEN: WS_OPEN,
        send: vi.fn(() => { throw new Error('Send failed'); }),
      };
      const clients = new Map();
      clients.set('agent-1:session-1', mockWs as any);
      setWsClients(clients);

      pushWsResult('agent-1', 'session-1', {});

      // Should not throw
    });
  });

  describe('pushWsChunk', () => {
    it('should send chunk to client', () => {
      const mockWs = {
        readyState: WS_OPEN,
        OPEN: WS_OPEN,
        send: vi.fn(),
      };
      const clients = new Map();
      clients.set('agent-1:session-1', mockWs as any);
      setWsClients(clients);

      pushWsChunk('agent-1', 'session-1', 'Hello');

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.type).toBe('chunk');
      expect(sentData.payload.chunk).toBe('Hello');
    });
  });

  describe('pushWsDone', () => {
    it('should send done signal', () => {
      const mockWs = {
        readyState: WS_OPEN,
        OPEN: WS_OPEN,
        send: vi.fn(),
      };
      const clients = new Map();
      clients.set('agent-1:session-1', mockWs as any);
      setWsClients(clients);

      pushWsDone('agent-1', 'session-1');

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.type).toBe('done');
    });
  });

  describe('pushWsApproval', () => {
    it('should send approval notification', () => {
      const mockWs = {
        readyState: WS_OPEN,
        OPEN: WS_OPEN,
        send: vi.fn(),
      };
      const clients = new Map();
      clients.set('agent-1:session-1', mockWs as any);
      setWsClients(clients);

      pushWsApproval('agent-1', 'session-1', 'approved', 'approval-1');

      expect(mockWs.send).toHaveBeenCalled();
      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.type).toBe('approval');
      expect(sentData.payload.action).toBe('approved');
    });

    it('should include detail', () => {
      const mockWs = {
        readyState: WS_OPEN,
        OPEN: WS_OPEN,
        send: vi.fn(),
      };
      const clients = new Map();
      clients.set('agent-1:session-1', mockWs as any);
      setWsClients(clients);

      pushWsApproval('agent-1', 'session-1', 'rejected', 'approval-1', { reason: 'test' });

      const sentData = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentData.payload.action).toBe('rejected');
      expect(sentData.payload.reason).toBe('test');
    });
  });
});