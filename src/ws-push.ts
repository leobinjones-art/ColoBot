/**
 * WebSocket push 工具 - 避免循环依赖
 * 由 colobot-server.ts 在初始化后设置 wsClients
 */

import type WebSocket from 'ws';

let wsClients: Map<string, WebSocket> | null = null;

export function setWsClients(clients: Map<string, WebSocket>): void {
  wsClients = clients;
}

export function pushWsResult(
  agentId: string,
  sessionKey: string,
  result: unknown
): void {
  if (!wsClients) return;
  const clientId = `${agentId}:${sessionKey}`;
  const ws = wsClients.get(clientId);
  if (ws && ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify({ type: 'response', payload: { response: result } }));
  }
}
