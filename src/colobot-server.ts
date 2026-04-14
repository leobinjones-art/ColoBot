/**
 * ColoBot Server - HTTP + WebSocket 入口
 */

import 'dotenv/config';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { runAgent, searchAgentMemory } from './agent-runtime/runtime.js';
import type { ContentBlock } from './llm/index.js';
import { listSkills, matchesTrigger, executeSkill } from './agent-runtime/skill-runtime.js';
import { initTriggerEngine, fireWebhook } from './agent-runtime/trigger-runtime.js';
import { agentRegistry } from './agents/registry.js';
import { query } from './memory/db.js';
import { writeAudit } from './services/audit.js';
import { requireAuth, initAuth } from './middleware/auth.js';

const PORT = parseInt(process.env.COLOBOT_PORT || '18792');

// ─── 辅助函数 ───────────────────────────────────────────────

function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return String(forwarded[0]).split(',')[0].trim();
  return req.socket.remoteAddress?.replace('::ffff:', '') || '';
}

// ─── HTTP 服务器 ─────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;
  const clientIp = getClientIp(req);

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 认证：/api/* 路由需要 API Key（开发模式未配置时不验证）
  if (path.startsWith('/api/')) {
    try {
      requireAuth(req);
    } catch (e) {
      const err = e as { status?: number; message?: string };
      res.writeHead(err.status || 401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Unauthorized' }));
      return;
    }
  }

  try {
    // ── Agent 管理 ──
    if (path === '/api/agents' && method === 'GET') {
      const agents = await agentRegistry.list();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(agents));
      return;
    }

    if (path === '/api/agents' && method === 'POST') {
      const body = await parseBody(req);
      const agentInput = {
        name: String(body.name || ''),
        soul_content: body.soul_content ? String(body.soul_content) : undefined,
        primary_model_id: body.primary_model_id ? String(body.primary_model_id) : undefined,
        fallback_model_id: body.fallback_model_id ? String(body.fallback_model_id) : undefined,
        temperature: body.temperature ? Number(body.temperature) : undefined,
        max_tokens: body.max_tokens ? Number(body.max_tokens) : undefined,
        system_prompt_override: body.system_prompt_override ? String(body.system_prompt_override) : undefined,
      };
      const agent = await agentRegistry.create(agentInput);

      await writeAudit({
        actorType: 'user',
        actorName: agentInput.name,
        action: 'agent.create',
        targetType: 'agent',
        targetId: agent.id,
        targetName: agent.name,
        ipAddress: clientIp,
        result: 'success',
      });

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(agent));
      return;
    }

    if (path.match(/^\/api\/agents\/([^/]+)$/)) {
      const id = path.match(/^\/api\/agents\/([^/]+)$/)![1];
      if (method === 'GET') {
        const agent = await agentRegistry.get(id);
        if (!agent) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(agent));
        return;
      }
      if (method === 'DELETE') {
        const agent = await agentRegistry.get(id);
        await agentRegistry.delete(id);

        await writeAudit({
          actorType: 'user',
          action: 'agent.delete',
          targetType: 'agent',
          targetId: id,
          targetName: agent?.name,
          ipAddress: clientIp,
          result: 'success',
        });

        res.writeHead(204);
        res.end();
        return;
      }
    }

    // ── 消息处理 ──
    if (path === '/api/chat' && method === 'POST') {
      const body = await parseBody(req);
      const agent_id = String(body.agent_id || '');
      const session_key = String(body.session_key || '');
      // message 支持 string (纯文本) 或 ContentBlock[] (多模态)
      const message = body.message;

      if (!agent_id || !session_key || !message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing agent_id, session_key or message' }));
        return;
      }

      // Skill 触发仅支持文本匹配
      const messageText = typeof message === 'string' ? message
        : (Array.isArray(message) ? message.map(b => b.type === 'text' ? b.text : '').join(' ') : String(message));

      // 检查是否触发 Skill
      const skills = await listSkills();
      const triggeredSkill = skills.find(s => matchesTrigger(s, messageText));

      if (triggeredSkill) {
        const response = await executeSkill(triggeredSkill, agent_id, { sessionKey: session_key, userMessage: messageText });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ response }));
      } else {
        const result = await runAgent({ agentId: agent_id, sessionKey: session_key, userMessage: message as string | ContentBlock[], ipAddress: clientIp });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ response: result.response }));
      }
      return;
    }

    // ── 记忆搜索 ──
    if (path === '/api/memory/search' && method === 'POST') {
      const body = await parseBody(req);
      const agent_id = String(body.agent_id || '');
      const q = String(body.query || '');
      const result = await searchAgentMemory(agent_id, q);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ result }));
      return;
    }

    // ── SearXNG 搜索 ──
    if (path === '/api/search' && method === 'POST') {
      const body = await parseBody(req);
      const query = String(body.query || '');
      const { searxngSearch } = await import('./search/searxng.js');
      try {
        const result = await searxngSearch(query, {
          safe_search: body.safe_search ? Number(body.safe_search) as 0 | 1 | 2 : 0,
          time_range: body.time_range ? String(body.time_range) : undefined,
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error }));
      }
      return;
    }

    // ── Skills ──
    if (path === '/api/skills' && method === 'GET') {
      const skills = await listSkills();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(skills));
      return;
    }

    if (path === '/api/skills' && method === 'POST') {
      const body = await parseBody(req);
      const { name, description, markdown_content, trigger_words, trigger_config } = body;
      const id = crypto.randomUUID();
      await query(
        `INSERT INTO skills (id, name, description, markdown_content, trigger_words, trigger_config, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, true)`,
        [id, name, description || '', markdown_content, JSON.stringify(trigger_words || []), JSON.stringify(trigger_config || {})]
      );
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id, name, ok: true }));
      return;
    }

    // ── Triggers ──
    if (path === '/api/triggers/fire' && method === 'POST') {
      const body = await parseBody(req);
      const trigger_id = String(body.trigger_id || '');
      const payload = (body.payload as Record<string, unknown>) || {};
      await fireWebhook(trigger_id, payload);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ── Approvals ──
    if (path === '/api/approvals' && method === 'GET') {
      const agentId = url.searchParams.get('agent_id') || undefined;
      const { approvalFlow } = await import('./agent-runtime/approval.js');
      const pending = await approvalFlow.pending(agentId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pending));
      return;
    }

    if (path.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/)) {
      const match = path.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/)!;
      const id = match[1];
      const action = match[2];
      const body = await parseBody(req);
      const { approvalFlow } = await import('./agent-runtime/approval.js');

      let result;
      const approver = String(body.approver || 'system');
      if (action === 'approve') {
        result = await approvalFlow.approve(id, approver, (body.result as Record<string, unknown>) || {});
      } else {
        result = await approvalFlow.reject(id, approver, String(body.reason || ''));
      }

      await writeAudit({
        actorType: 'user',
        actorName: approver,
        action: `approval.${action}`,
        targetType: 'approval_request',
        targetId: id,
        ipAddress: clientIp,
        result: 'success',
        detail: { result },
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // ── Health ──
    if (path === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', ts: new Date().toISOString() }));
      return;
    }

    // 404
    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    console.error('[HTTP Error]', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: String(e) }));
  }
});

// ─── WebSocket ──────────────────────────────────────────────

const wss = new WebSocketServer({ server });
const wsClients = new Map<string, WebSocket>();

wss.on('connection', (ws, req) => {
  // WebSocket 认证
  try {
    requireAuth(req as any);
  } catch {
    ws.send(JSON.stringify({ type: 'error', payload: { error: 'Unauthorized' } }));
    ws.close();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const sessionKey = url.searchParams.get('session') || 'default';
  const agentId = url.searchParams.get('agent_id') || 'default';

  const clientId = `${agentId}:${sessionKey}`;
  wsClients.set(clientId, ws);

  console.log(`[WS] Connected: ${clientId}`);

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString()) as { type: string; payload: Record<string, unknown> };

      if (msg.type === 'chat') {
        const { message } = msg.payload;
        const skills = await listSkills();
        const triggeredSkill = skills.find(s => matchesTrigger(s, message as string));

        let response: string | ContentBlock[];
        if (triggeredSkill) {
          response = await executeSkill(triggeredSkill, agentId, { sessionKey, userMessage: message as string });
        } else {
          const result = await runAgent({ agentId, sessionKey, userMessage: message as string });
          response = result.response;
        }

        ws.send(JSON.stringify({ type: 'response', payload: { response } }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', payload: { error: String(e) } }));
    }
  });

  ws.on('close', () => {
    wsClients.delete(clientId);
    console.log(`[WS] Disconnected: ${clientId}`);
  });
});

// ─── 工具函数 ───────────────────────────────────────────────

function parseBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ─── 启动 ───────────────────────────────────────────────────

async function main() {
  // 初始化认证（CLI 参数或交互式）
  await initAuth();

  // 初始化数据库
  try {
    await query('SELECT 1');
    console.log('[DB] Connected');
  } catch (e) {
    console.error('[DB] Connection failed:', e);
    process.exit(1);
  }

  // 初始化 Trigger 引擎
  await initTriggerEngine();

  server.listen(PORT, () => {
    console.log(`[ColoBot] Server running at http://localhost:${PORT}`);
    console.log(`[ColoBot] WebSocket at ws://localhost:${PORT}?agent_id=<id>&session=<key>`);
  });
}

main().catch(console.error);
