/**
 * WebSocket Channel Adapter
 * 提供 WebSocket 连接，作为消息入口
 */

import { WebSocket, WebSocketServer } from 'ws';
import { URL } from 'url';

export interface ChannelMessage {
  type: 'chat' | 'ping' | 'pong';
  payload: Record<string, unknown>;
}

export interface ChannelAdapter {
  name: string;
  send(message: ChannelMessage): Promise<void>;
  onMessage(handler: (msg: ChannelMessage) => void): void;
  close(): void;
}

export class WsChannelAdapter implements ChannelAdapter {
  name = 'websocket';
  private ws: WebSocket;
  private messageHandler: ((msg: ChannelMessage) => void) | null = null;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString()) as ChannelMessage;
        this.messageHandler?.(msg);
      } catch (e) {
        console.error('[WsChannel] Parse error:', e);
      }
    });
  }

  async send(message: ChannelMessage): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this.ws.send(JSON.stringify(message));
  }

  onMessage(handler: (msg: ChannelMessage) => void): void {
    this.messageHandler = handler;
  }

  close(): void {
    this.ws.close();
  }
}

export class WsServerAdapter implements ChannelAdapter {
  name = 'websocket-server';
  private wss: WebSocketServer;
  private clients = new Set<WebSocket>();
  private messageHandler: ((msg: ChannelMessage) => void) | null = null;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.wss.on('connection', (ws) => {
      this.clients.add(ws);
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as ChannelMessage;
          this.messageHandler?.(msg);
        } catch (e) {
          console.error('[WsServer] Parse error:', e);
        }
      });
      ws.on('close', () => { this.clients.delete(ws); });
    });
  }

  async send(message: ChannelMessage): Promise<void> {
    const data = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }
  }

  onMessage(handler: (msg: ChannelMessage) => void): void {
    this.messageHandler = handler;
  }

  close(): void {
    this.wss.close();
  }
}
