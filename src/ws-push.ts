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
  try {
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'response', payload: { response: result } }));
    }
  } catch (e) {
    console.warn(`[WS] Failed to send result to ${clientId}:`, e);
  }
}

export function pushWsChunk(
  agentId: string,
  sessionKey: string,
  chunk: string
): void {
  if (!wsClients) return;
  const clientId = `${agentId}:${sessionKey}`;
  const ws = wsClients.get(clientId);
  try {
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'chunk', payload: { chunk } }));
    }
  } catch (e) {
    console.warn(`[WS] Failed to send chunk to ${clientId}:`, e);
  }
}

export function pushWsDone(
  agentId: string,
  sessionKey: string
): void {
  if (!wsClients) return;
  const clientId = `${agentId}:${sessionKey}`;
  const ws = wsClients.get(clientId);
  try {
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'done', payload: {} }));
    }
  } catch (e) {
    console.warn(`[WS] Failed to send done to ${clientId}:`, e);
  }
}

export function pushWsApproval(
  agentId: string,
  sessionKey: string,
  action: 'approved' | 'rejected' | 'expired',
  approvalId: string,
  detail?: Record<string, unknown>
): void {
  if (!wsClients) return;
  const clientId = `${agentId}:${sessionKey}`;
  const ws = wsClients.get(clientId);
  try {
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({
        type: 'approval',
        payload: { action, approvalId, ...detail },
      }));
    }
  } catch (e) {
    console.warn(`[WS] Failed to send approval to ${clientId}:`, e);
  }
}
