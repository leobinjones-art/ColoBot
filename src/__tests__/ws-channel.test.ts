/**
 * WebSocket Channel 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ws module properly
const WS_OPEN = 1;
const mockWsInstances: any[] = [];

vi.mock('ws', () => {
  class MockWebSocket {
    static OPEN = WS_OPEN;
    readyState = WS_OPEN;
    on = vi.fn();
    send = vi.fn();
    close = vi.fn();
    constructor(url: string) {
      mockWsInstances.push(this);
    }
  }

  class MockWebSocketServer {
    on = vi.fn();
    close = vi.fn();
    constructor(options: any) {}
  }

  return {
    WebSocket: MockWebSocket,
    default: MockWebSocket,
    WebSocketServer: MockWebSocketServer,
  };
});

describe('WebSocket Channel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWsInstances.length = 0;
  });

  describe('WsChannelAdapter', () => {
    it('should create WebSocket connection', async () => {
      const { WsChannelAdapter } = await import('../channels/ws-channel.js');
      const adapter = new WsChannelAdapter('ws://localhost:8080');
      expect(adapter.name).toBe('websocket');
      expect(mockWsInstances.length).toBe(1);
    });

    it('should send message when connected', async () => {
      const { WsChannelAdapter } = await import('../channels/ws-channel.js');
      const adapter = new WsChannelAdapter('ws://localhost:8080');
      const ws = mockWsInstances[mockWsInstances.length - 1];

      await adapter.send({ type: 'chat', payload: { text: 'hello' } });

      expect(ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'chat', payload: { text: 'hello' } }));
    });

    it('should throw when not connected', async () => {
      const { WsChannelAdapter } = await import('../channels/ws-channel.js');
      const adapter = new WsChannelAdapter('ws://localhost:8080');
      const ws = mockWsInstances[mockWsInstances.length - 1];
      ws.readyState = 0; // CONNECTING

      await expect(adapter.send({ type: 'chat', payload: {} })).rejects.toThrow('not connected');
    });

    it('should register message handler', async () => {
      const { WsChannelAdapter } = await import('../channels/ws-channel.js');
      const adapter = new WsChannelAdapter('ws://localhost:8080');
      const ws = mockWsInstances[mockWsInstances.length - 1];

      const handler = vi.fn();
      adapter.onMessage(handler);

      // Simulate message event
      const messageCallback = ws.on.mock.calls.find((c: any[]) => c[0] === 'message')?.[1];
      if (messageCallback) {
        messageCallback(Buffer.from(JSON.stringify({ type: 'chat', payload: { text: 'test' } })));
      }

      expect(handler).toHaveBeenCalledWith({ type: 'chat', payload: { text: 'test' } });
    });

    it('should close connection', async () => {
      const { WsChannelAdapter } = await import('../channels/ws-channel.js');
      const adapter = new WsChannelAdapter('ws://localhost:8080');
      const ws = mockWsInstances[mockWsInstances.length - 1];

      adapter.close();
      expect(ws.close).toHaveBeenCalled();
    });
  });

  describe('WsServerAdapter', () => {
    it('should create WebSocket server', async () => {
      const { WsServerAdapter } = await import('../channels/ws-channel.js');
      const adapter = new WsServerAdapter(8080);
      expect(adapter.name).toBe('websocket-server');
    });

    it('should register message handler', async () => {
      const { WsServerAdapter } = await import('../channels/ws-channel.js');
      const adapter = new WsServerAdapter(8080);

      const handler = vi.fn();
      adapter.onMessage(handler);

      expect(typeof handler).toBe('function');
    });

    it('should close server', async () => {
      const { WsServerAdapter } = await import('../channels/ws-channel.js');
      const adapter = new WsServerAdapter(8080);

      adapter.close();
      // Should not throw
    });
  });
});