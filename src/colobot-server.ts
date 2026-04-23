/**
 * ColoBot Server - HTTP + WebSocket 入口
 */

import 'dotenv/config';
import http from 'http';
import * as nodePath from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import fs from 'fs';
import { runAgent, runAgentStream, searchAgentMemory } from './agent-runtime/runtime.js';
import type { ContentBlock } from './llm/index.js';
import { listSkills, matchesTrigger, executeSkill } from './agent-runtime/skill-runtime.js';
import { initTriggerEngine, fireWebhook } from './agent-runtime/trigger-runtime.js';
import { agentRegistry } from './agents/registry.js';
import { query, queryOne } from './memory/db.js';
import { writeAudit } from './services/audit.js';
import type { KnowledgeCategory } from './services/knowledge.js';
import { requireAuth, initAuth, hasKeys, isAuthConfigured, validateKey } from './middleware/auth.js';
import { safeFetch } from './utils/safe-fetch.js';
import { checkRateLimit, getClientIP, rateLimitResponse, DEFAULTS } from './utils/rate-limit.js';
import { startLongPolling } from './services/feishu-long-polling.js';

const PORT = parseInt(process.env.COLOBOT_PORT || '18792');

// ─── 辅助函数 ───────────────────────────────────────────────

function isValidKnowledgeCategory(category: unknown): category is KnowledgeCategory {
  return typeof category === 'string' && ['concept', 'template', 'rule'].includes(category);
}

function getClientIp(req: http.IncomingMessage): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim();
  if (Array.isArray(forwarded)) return String(forwarded[0]).split(',')[0].trim();
  return req.socket.remoteAddress?.replace('::ffff:', '') || '';
}

// ─── Static File Serving ──────────────────────────────────────

const distDir = new URL('../dashboard', import.meta.url).pathname;

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse): boolean {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  if ((path === '/' || path === '/dashboard' || path.startsWith('/dashboard/')) && req.method === 'GET') {
    let filePath = path === '/' ? '/index.html' : path;
    if (filePath === '/dashboard') filePath = '/index.html';
    const fullPath = distDir + filePath;

    try {
      if (fs.existsSync(fullPath)) {
        const ext = fullPath.split('.').pop()?.toLowerCase();
        const contentTypes: Record<string, string> = {
          html: 'text/html; charset=utf-8',
          js: 'application/javascript',
          css: 'text/css',
          json: 'application/json',
          png: 'image/png',
          ico: 'image/x-icon',
        };
        res.writeHead(200, { 'Content-Type': contentTypes[ext || 'html'] || 'text/plain; charset=utf-8' });
        res.end(fs.readFileSync(fullPath));
        return true;
      }
    } catch { /* file not found */ }
  }
  return false;
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

  // 静态文件：dashboard /
  if (serveStatic(req, res)) return;

  // ── Login（无需认证，但有 Rate Limit） ──
  if (path === '/api/login' && method === 'POST') {
    // Rate limit: 60s 内最多 5 次
    const ip = getClientIP(req);
    const rl = checkRateLimit(`login:${ip}`, DEFAULTS.login);
    if (!rl.allowed) {
      const { status, headers, body } = rateLimitResponse(rl.retryAfterMs!);
      res.writeHead(status, headers);
      res.end(body);
      return;
    }

    const body = await parseBody(req);
    const key = String(body.key || '');
    if (!isAuthConfigured() || !hasKeys()) {
      // 未配置 key，无需登录
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, devMode: true }));
      return;
    }
    if (validateKey(key)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } else {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid API Key' }));
    }
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
      // Rate limit: 60s 内最多 30 次
      const rl = checkRateLimit(`chat:${clientIp}`, DEFAULTS.chat);
      if (!rl.allowed) {
        const { status, headers, body } = rateLimitResponse(rl.retryAfterMs!);
        res.writeHead(status, headers);
        res.end(body);
        return;
      }

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
        if ('pending' in result) {
          // 危险工具正在等待审批
          res.writeHead(202, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ pending: true, approvalId: result.approvalId }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ response: result.response }));
        }
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
        const status = error.includes('429') || error.includes('503') ? 429 : 500;
        res.writeHead(status, { 'Content-Type': 'application/json' });
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

    // GET /api/skills/:id - 获取单个 skill
    const skillDetailMatch = path.match(/^\/api\/skills\/([a-f0-9-]+)$/);
    if (skillDetailMatch && method === 'GET') {
      const skillId = skillDetailMatch[1];
      const skill = await queryOne('SELECT * FROM skills WHERE id = $1', [skillId]);
      if (!skill) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Skill not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(skill));
      return;
    }

    // PUT /api/skills/:id - 更新 skill
    if (skillDetailMatch && method === 'PUT') {
      const skillId = skillDetailMatch[1];
      const body = await parseBody(req);
      const { name, description, markdown_content, trigger_words, enabled } = body;
      await query(
        `UPDATE skills SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          markdown_content = COALESCE($3, markdown_content),
          trigger_words = COALESCE($4, trigger_words),
          enabled = COALESCE($5, enabled),
          updated_at = NOW()
         WHERE id = $6`,
        [name, description, markdown_content, trigger_words ? JSON.stringify(trigger_words) : null, enabled, skillId]
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // DELETE /api/skills/:id - 删除 skill
    if (skillDetailMatch && method === 'DELETE') {
      const skillId = skillDetailMatch[1];
      await query('DELETE FROM skills WHERE id = $1', [skillId]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // GET /api/skills/pending - 获取待审批 skills
    if (path === '/api/skills/pending' && method === 'GET') {
      const { listPendingSkills } = await import('./agent-runtime/skill-evolution.js');
      const pending = await listPendingSkills();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(pending));
      return;
    }

    // POST /api/skills/pending/:name/approve - 审批通过
    const pendingApproveMatch = path.match(/^\/api\/skills\/pending\/([^/]+)\/approve$/);
    if (pendingApproveMatch && method === 'POST') {
      const skillName = decodeURIComponent(pendingApproveMatch[1]);
      const { approveSkill } = await import('./agent-runtime/skill-evolution.js');
      await approveSkill(skillName, 'admin');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // POST /api/skills/pending/:name/reject - 审批拒绝
    const pendingRejectMatch = path.match(/^\/api\/skills\/pending\/([^/]+)\/reject$/);
    if (pendingRejectMatch && method === 'POST') {
      const skillName = decodeURIComponent(pendingRejectMatch[1]);
      const body = await parseBody(req);
      const { rejectSkill } = await import('./agent-runtime/skill-evolution.js');
      await rejectSkill(skillName, 'admin', body.reason as string | undefined);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // POST /api/skills/import/clawhub - 从 ClawHub 格式导入
    if (path === '/api/skills/import/clawhub' && method === 'POST') {
      const body = await parseBody(req);
      const { importFromClawHub, importFromClawHubUrl } = await import('./agent-runtime/tools/clawhub-compat.js');

      try {
        let skill;
        if (body.url) {
          skill = await importFromClawHubUrl(body.url as string);
        } else if (body.content) {
          skill = await importFromClawHub(body.content as string);
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'content or url required' }));
          return;
        }
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, skill }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
      return;
    }

    // GET /api/skills/:id/export/clawhub - 导出为 ClawHub 格式
    const skillExportMatch = path.match(/^\/api\/skills\/([a-f0-9-]+)\/export\/clawhub$/);
    if (skillExportMatch && method === 'GET') {
      const skillId = skillExportMatch[1];
      const { exportToClawHub } = await import('./agent-runtime/tools/clawhub-compat.js');

      try {
        const content = await exportToClawHub(skillId);
        res.writeHead(200, { 'Content-Type': 'text/markdown' });
        res.end(content);
      } catch (e) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: String(e) }));
      }
      return;
    }

    // GET /api/skills/export/clawhub - 导出所有 Skill 为 ClawHub 格式
    if (path === '/api/skills/export/clawhub' && method === 'GET') {
      const { exportAllToClawHub } = await import('./agent-runtime/tools/clawhub-compat.js');
      const content = await exportAllToClawHub();
      res.writeHead(200, { 'Content-Type': 'text/markdown' });
      res.end(content);
      return;
    }

    // ── Knowledge ──
    if (path === '/api/knowledge' && method === 'GET') {
      const category = url.searchParams.get('category') || undefined;
      const { listKnowledge } = await import('./services/knowledge.js');
      const entries = await listKnowledge(category as KnowledgeCategory | undefined);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(entries));
      return;
    }
    if (path === '/api/knowledge' && method === 'POST') {
      const body = await parseBody(req);
      const { addKnowledge } = await import('./services/knowledge.js');
      const entry = await addKnowledge({
        category: body.category as KnowledgeCategory,
        name: String(body.name || ''),
        content: String(body.content || ''),
        variables: (body.variables as string[]) || [],
        related: (body.related as string[]) || [],
      });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, id: entry.id }));
      return;
    }
    if (path === '/api/knowledge/search' && method === 'POST') {
      const body = await parseBody(req);
      const { searchKnowledge } = await import('./services/knowledge.js');
      const q = String(body.query || '');
      const category = body.category || undefined;

      // 验证category类型
      let knowledgeCategory: KnowledgeCategory | undefined;
      if (category) {
        if (!isValidKnowledgeCategory(category)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid category' }));
          return;
        }
        knowledgeCategory = category;
      }

      const results = await searchKnowledge(q, knowledgeCategory);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results));
      return;
    }
    if (path.match(/^\/api\/knowledge\/([^/]+)\/([^/]+)$/)) {
      const match = path.match(/^\/api\/knowledge\/([^/]+)\/([^/]+)$/)!;
      const category = match[1];
      const name = decodeURIComponent(match[2]);

      // 验证category类型
      if (!isValidKnowledgeCategory(category)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid category' }));
        return;
      }

      if (method === 'GET') {
        const { getKnowledge } = await import('./services/knowledge.js');
        const entry = await getKnowledge(category, name);
        if (!entry) { res.writeHead(404); res.end('Not found'); return; }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(entry));
        return;
      }
      if (method === 'DELETE') {
        const { deleteKnowledge } = await import('./services/knowledge.js');
        await deleteKnowledge(category, name);
        res.writeHead(204);
        res.end();
        return;
      }
    }

    // 知识库文件导入
    if (path === '/api/knowledge/import' && method === 'POST') {
      const body = await parseBody(req);
      const { addKnowledge } = await import('./services/knowledge.js');
      const rawEntries = (body.entries as Array<{ category: string; name: string; content: string; variables?: string[]; related?: string[] }>) || [];
      const results = [];
      for (const e of rawEntries) {
        const entry = await addKnowledge({ ...e, category: e.category as KnowledgeCategory });
        results.push({ ok: true, id: entry.id, name: entry.name });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ imported: results.length, results }));
      return;
    }

    // OpenClaw SOUL.md 导入
    if (path === '/api/agents/import' && method === 'POST') {
      const body = await parseBody(req);
      const { parseOpenClawSoul, toColoBotSoul } = await import('./agent-runtime/tools/openclaw.js');

      if (!body.markdown && !body.url) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Either markdown or url is required' }));
        return;
      }

      let markdown = body.markdown as string;

      // 支持从 URL 拉取
      if (!markdown && body.url) {
        try {
          const fetched = await safeFetch(body.url as string);
          if (!fetched.ok) throw new Error(`HTTP ${fetched.status}`);
          markdown = await fetched.text();
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Failed to fetch URL: ${e}` }));
          return;
        }
      }

      const parsed = parseOpenClawSoul(markdown, body.name as string);
      const soulContent = toColoBotSoul(parsed);

      // 可选：直接创建 Agent
      if (body.create === true) {
        const { agentRegistry } = await import('./agents/registry.js');
        const agent = await agentRegistry.create({
          name: String(body.name || parsed.role || 'imported-agent'),
          soul_content: soulContent,
          primary_model_id: body.primary_model_id ? String(body.primary_model_id) : undefined,
          fallback_model_id: body.fallback_model_id ? String(body.fallback_model_id) : undefined,
        });
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, agent, soul: parsed }));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ soul: parsed }));
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

    if (path === '/api/triggers/condition-fire' && method === 'POST') {
      const body = await parseBody(req);
      const trigger_id = String(body.trigger_id || '');
      const context = (body.context as Record<string, unknown>) || {};
      const { fireConditionTrigger } = await import('./agent-runtime/trigger-runtime.js');
      const result = await fireConditionTrigger(trigger_id, context);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
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
        // approve() 内部已异步触发 continueRun()，会执行危险工具并继续 LLM 对话
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

    // ── Audit Logs ──
    if (path === '/api/audit' && method === 'GET') {
      const { listAudit } = await import('./services/audit.js');
      const action = url.searchParams.get('action') || undefined;
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const offset = parseInt(url.searchParams.get('offset') || '0');
      const from = url.searchParams.get('from') ? new Date(url.searchParams.get('from')!) : undefined;
      const to = url.searchParams.get('to') ? new Date(url.searchParams.get('to')!) : undefined;
      const result = await listAudit({ action, from, to, limit, offset });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // ── Security APIs (Poisoning Defense) ──
    if (path === '/api/security/trust-status' && method === 'GET') {
      const rows = await query('SELECT * FROM agent_trust_records ORDER BY updated_at DESC');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows));
      return;
    }
    if (path.match(/^\/api\/security\/trust-status\/[^/]+\/reset$/) && method === 'POST') {
      const agentId = path.split('/')[4];
      await query(
        `UPDATE agent_trust_records SET trust_score = 1.0, status = 'trusted', poisoning_attempts = 0, last_violation_at = NULL WHERE agent_id = $1`,
        [agentId]
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true }));
      return;
    }
    if (path === '/api/security/poisoning-attempts' && method === 'GET') {
      const { listPoisoningAttempts } = await import('./services/poison-defense.js');
      const agentId = url.searchParams.get('agentId') || undefined;
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const result = await listPoisoningAttempts(agentId, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }
    if (path.match(/^\/api\/security\/poisoning-attempts\/[^/]+$/) && method === 'GET') {
      const id = path.split('/')[4];
      const row = await queryOne<{ id: string; source: string; issues: string }>('SELECT * FROM poisoning_attempts WHERE id = $1', [id]);
      if (!row) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Not found' }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...row,
        source: typeof row.source === 'string' ? JSON.parse(row.source) : row.source,
        issues: typeof row.issues === 'string' ? JSON.parse(row.issues) : row.issues,
      }));
      return;
    }
    if (path === '/api/security/write-audit' && method === 'GET') {
      const limit = parseInt(url.searchParams.get('limit') || '50');
      const rows = await query<{ id: string; source: string }>('SELECT * FROM content_write_audit ORDER BY created_at DESC LIMIT $1', [limit]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(rows.map((r: { id: string; source: string }) => ({
        ...r,
        source: typeof r.source === 'string' ? JSON.parse(r.source) : r.source,
      }))));
      return;
    }
    if (path === '/api/security/rollback' && method === 'POST') {
      const { rollbackPoisonedContent } = await import('./services/poison-defense.js');
      const body = await parseBody(req) as { contentType: 'memory' | 'skill' | 'knowledge'; contentKey: string };
      const success = await rollbackPoisonedContent(body.contentType, body.contentKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success }));
      return;
    }

    // ── Tools List ──
    if (path === '/api/tools' && method === 'GET') {
      const { listTools } = await import('./agent-runtime/tools/executor.js');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(listTools()));
      return;
    }

    // ── Settings ──
    if (path === '/api/settings/feishu' && method === 'GET') {
      const { getFeishuSettings } = await import('./services/settings.js');
      const result = await getFeishuSettings();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }
    if (path === '/api/settings/feishu' && method === 'PUT') {
      const { saveFeishuSettings } = await import('./services/settings.js');
      const body = await parseBody(req);
      await saveFeishuSettings(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ── SubAgent List ──
    if (path === '/api/subagents' && method === 'GET') {
      const { listSubAgents } = await import('./agent-runtime/sub-agents.js');
      const agents = listSubAgents('');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(agents.map(a => ({
        id: a.id,
        name: a.name,
        status: a.status,
        workspacePath: a.workspacePath,
        expiresAt: a.expiresAt,
        createdAt: a.createdAt,
      }))));
      return;
    }

    // ── SubAgent Settings ──
    if (path === '/api/settings/subagent' && method === 'GET') {
      const { getSetting, SETTINGS_KEYS } = await import('./services/settings.js');
      const allowedTools = await getSetting(SETTINGS_KEYS.SUBAGENT_ALLOWED_TOOLS);
      const blockedTools = await getSetting(SETTINGS_KEYS.SUBAGENT_BLOCKED_TOOLS);
      const defaultTtlMs = await getSetting(SETTINGS_KEYS.SUBAGENT_DEFAULT_TTL_MS);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        allowedTools: allowedTools ? JSON.parse(allowedTools) : null,
        blockedTools: blockedTools ? JSON.parse(blockedTools) : null,
        defaultTtlMs: defaultTtlMs ? parseInt(defaultTtlMs) : 300000,
      }));
      return;
    }
    if (path === '/api/settings/subagent' && method === 'PUT') {
      const { setSetting, SETTINGS_KEYS } = await import('./services/settings.js');
      const body = await parseBody(req);
      if (body.allowedTools !== undefined) {
        await setSetting(SETTINGS_KEYS.SUBAGENT_ALLOWED_TOOLS, JSON.stringify(body.allowedTools), 'SubAgent allowed tools whitelist');
      }
      if (body.blockedTools !== undefined) {
        await setSetting(SETTINGS_KEYS.SUBAGENT_BLOCKED_TOOLS, JSON.stringify(body.blockedTools), 'SubAgent blocked tools blacklist');
      }
      if (body.defaultTtlMs !== undefined) {
        await setSetting(SETTINGS_KEYS.SUBAGENT_DEFAULT_TTL_MS, String(body.defaultTtlMs), 'SubAgent default TTL in ms');
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ── User Profile ──
    // GET /api/profile/:agentId - 获取用户画像
    const profileMatch = path.match(/^\/api\/profile\/([a-f0-9-]+)$/);
    if (profileMatch && method === 'GET') {
      const agentId = profileMatch[1];
      const { getUserProfile } = await import('./services/user-profile.js');
      const profile = await getUserProfile(agentId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(profile || {}));
      return;
    }

    // PUT /api/profile/:agentId - 更新用户画像
    if (profileMatch && method === 'PUT') {
      const agentId = profileMatch[1];
      const body = await parseBody(req);
      const { upsertUserProfile } = await import('./services/user-profile.js');
      const profile = await upsertUserProfile(agentId, body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(profile));
      return;
    }

    // DELETE /api/profile/:agentId - 删除用户画像
    if (profileMatch && method === 'DELETE') {
      const agentId = profileMatch[1];
      const { deleteUserProfile } = await import('./services/user-profile.js');
      await deleteUserProfile(agentId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // GET /api/profile/:agentId/summary - 获取画像摘要
    const profileSummaryMatch = path.match(/^\/api\/profile\/([a-f0-9-]+)\/summary$/);
    if (profileSummaryMatch && method === 'GET') {
      const agentId = profileSummaryMatch[1];
      const { getProfileSummary } = await import('./services/user-profile.js');
      const summary = await getProfileSummary(agentId);
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(summary);
      return;
    }

    // ── Workspace File Browser ──
    // GET /api/workspace/:subAgentId - list workspace contents
    // GET /api/workspace/:subAgentId/files/*path - download file
    // POST /api/workspace/:subAgentId/files/*path - upload file
    if (path.startsWith('/api/workspace/') && method === 'GET') {
      const parts = path.split('/');
      // ["", "api", "workspace", "{subAgentId}", "files", "...path"]
      if (parts.length >= 4 && parts[2] === 'workspace') {
        const subAgentId = parts[3];
        const { getSubAgent, getSubAgentWorkspacePath } = await import('./agent-runtime/sub-agents.js');
        const agent = getSubAgent(subAgentId);
        if (!agent) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'SubAgent not found or expired' }));
          return;
        }
        const workspacePath = getSubAgentWorkspacePath(subAgentId);
        if (!workspacePath) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Workspace not found' }));
          return;
        }

        import('fs/promises').then(async (fsP) => {
          try {
            const isDownload = parts[4] === 'files';
            const filePath = isDownload && parts[5]
              ? '/' + parts.slice(5).join('/')
              : '/';
            const fullPath = workspacePath + filePath;

            const stats = await fsP.stat(fullPath);
            if (stats.isDirectory()) {
              const entries = await fsP.readdir(fullPath, { withFileTypes: true });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                path: filePath,
                entries: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file', size: e.isDirectory() ? null : stats.size }))
              }));
            } else {
              const content = await fsP.readFile(fullPath);
              const fileName = filePath.split('/').pop() || 'file';
              res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': content.length
              });
              res.end(content);
            }
          } catch (e) {
            const err = e as { code?: string };
            if (err.code === 'ENOENT') {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'File not found' }));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(e) }));
            }
          }
        });
        return;
      }
    }

    // ── Agent File Download (for SOP reports etc.) ──
    // GET /api/files/:agentId/*path - download file from agent workspace
    if (path.startsWith('/api/files/') && method === 'GET') {
      const parts = path.split('/');
      // ["", "api", "files", "{agentId}", "...path"]
      if (parts.length >= 4 && parts[2] === 'files') {
        const agentId = parts[3];
        const filePath = parts.length >= 5 ? '/' + parts.slice(4).join('/') : '/';
        const fullPath = `/workspace/${agentId}${filePath}`;

        import('fs/promises').then(async (fsP) => {
          try {
            const stats = await fsP.stat(fullPath);
            if (stats.isDirectory()) {
              const entries = await fsP.readdir(fullPath, { withFileTypes: true });
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                path: filePath,
                entries: entries.map(e => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }))
              }));
            } else {
              const content = await fsP.readFile(fullPath);
              const fileName = filePath.split('/').pop() || 'file';
              res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': content.length
              });
              res.end(content);
            }
          } catch (e) {
            const err = e as { code?: string };
            if (err.code === 'ENOENT') {
              res.writeHead(404, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'File not found' }));
            } else {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: String(e) }));
            }
          }
        });
        return;
      }
    }

    // POST /api/workspace/:subAgentId/files/*path - upload file
    if (path.startsWith('/api/workspace/') && method === 'POST') {
      const parts = path.split('/');
      if (parts.length >= 5 && parts[2] === 'workspace' && parts[4] === 'files') {
        const subAgentId = parts[3];
        const { getSubAgent, getSubAgentWorkspacePath } = await import('./agent-runtime/sub-agents.js');
        const agent = getSubAgent(subAgentId);
        if (!agent) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'SubAgent not found or expired' }));
          return;
        }
        const workspacePath = getSubAgentWorkspacePath(subAgentId);
        if (!workspacePath) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Workspace not found' }));
          return;
        }

        const filePath = '/' + parts.slice(5).join('/');
        const fullPath = workspacePath + filePath;

        // 获取上传的文件
        const { parseMultipart } = await import('./utils/multipart.js').catch(() => ({ parseMultipart: null }));
        if (!parseMultipart) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Multipart parser not available' }));
          return;
        }

        try {
          const { files } = await parseMultipart(req);
          if (!files || files.length === 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No file uploaded' }));
            return;
          }

          const file = files[0];
          const dirPath = nodePath.dirname(fullPath);
          await fs.promises.mkdir(dirPath, { recursive: true });
          await fs.promises.writeFile(fullPath, file.content);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, path: filePath, size: file.content.length }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(e) }));
        }
        return;
      }
    }

    // ── SearXNG Settings ──
    if (path === '/api/settings/searxng' && method === 'GET') {
      const { getSearXNGSettings } = await import('./services/settings.js');
      const result = await getSearXNGSettings();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }
    if (path === '/api/settings/searxng' && method === 'PUT') {
      const { saveSearXNGSettings } = await import('./services/settings.js');
      const body = await parseBody(req);
      await saveSearXNGSettings(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ── LLM Settings ──
    if (path === '/api/settings/llm' && method === 'GET') {
      const { getLlmSettings } = await import('./services/settings-cache.js');
      const settings = await getLlmSettings();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(settings));
      return;
    }
    if (path === '/api/settings/llm' && method === 'PUT') {
      const { saveLlmSettings } = await import('./services/settings-cache.js');
      const body = await parseBody(req);
      await saveLlmSettings(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ── LLM Test & Models ──
    if (path === '/api/llm/test' && method === 'POST') {
      const body = await parseBody(req);
      const provider = body.provider || 'openai';
      const apiKey = String(body.api_key || '');
      const { getDefaultModel, getApiEndpoint } = await import('./config/llm.js');
      try {
        if (provider === 'openai') {
          const res2 = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${apiKey}` }
          });
          if (!res2.ok) throw new Error(`OpenAI API error: ${res2.status}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, provider: 'openai' }));
        } else if (provider === 'anthropic') {
          const model = getDefaultModel('anthropic');
          const endpoint = getApiEndpoint('anthropic');
          const res2 = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model, max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] })
          });
          if (!res2.ok) throw new Error(`Anthropic API error: ${res2.status}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, provider: 'anthropic' }));
        } else if (provider === 'minimax') {
          const model = getDefaultModel('minimax');
          const endpoint = process.env.MINIMAX_STREAM_ENDPOINT || 'https://api.minimaxi.com/v1/text/chatcompletion_v2';
          const res2 = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ model, messages: [{ role: 'user', content: 'hi' }], max_tokens: 1 })
          });
          if (!res2.ok) throw new Error(`MiniMax API error: ${res2.status}`);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, provider: 'minimax' }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unknown provider' }));
        }
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: (e as Error).message }));
      }
      return;
    }

    if (path === '/api/llm/models' && method === 'GET') {
      const { getLlmProvider, getOpenAIApiKey } = await import('./services/settings-cache.js');
      const provider = getLlmProvider();
      const models: { id: string; name: string; provider: string }[] = [];

      if (provider === 'openai') {
        const apiKey = getOpenAIApiKey();
        if (apiKey) {
          try {
            const res2 = await fetch('https://api.openai.com/v1/models', {
              headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            if (res2.ok) {
              const data = await res2.json() as { data: Array<{ id: string }> };
              const gptModels = data.data.filter(m => m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3')).map(m => ({ id: m.id, name: m.id, provider: 'openai' }));
              models.push(...gptModels);
            }
          } catch { /* ignore */ }
        }
        if (models.length === 0) {
          models.push(
            { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
            { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
            { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
            { id: 'o1', name: 'o1', provider: 'openai' },
            { id: 'o1-mini', name: 'o1 Mini', provider: 'openai' },
          );
        }
      } else if (provider === 'anthropic') {
        models.push(
          { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic' },
          { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
        );
      } else if (provider === 'minimax') {
        models.push(
          { id: 'MiniMax-M2.7-highspeed', name: 'MiniMax M2.7 Highspeed', provider: 'minimax' },
          { id: 'MiniMax-M2.7', name: 'MiniMax M2.7', provider: 'minimax' },
        );
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ provider, models }));
      return;
    }

    // ── Notification Settings ──
    if (path === '/api/settings/notifications' && method === 'GET') {
      const { getNotificationSettings } = await import('./services/settings-cache.js');
      const settings = await getNotificationSettings();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(settings));
      return;
    }
    if (path === '/api/settings/notifications' && method === 'PUT') {
      const { saveNotificationSettings } = await import('./services/settings-cache.js');
      const body = await parseBody(req);
      await saveNotificationSettings(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // ── SOP Configuration ──
    // GET /api/settings/sop/prompts
    if (path === '/api/settings/sop/prompts' && method === 'GET') {
      const { getAllSopPrompts } = await import('./config/sop-prompts.js');
      const prompts = await getAllSopPrompts();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ prompts }));
      return;
    }

    // PUT /api/settings/sop/prompts/:name
    if (path.startsWith('/api/settings/sop/prompts/') && method === 'PUT') {
      const name = path.split('/')[4];
      const { saveSopPromptToDb } = await import('./config/sop-prompts.js');
      const body = await parseBody(req) as { value: string };
      await saveSopPromptToDb(name, body.value);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // GET /api/settings/sop/subagents
    if (path === '/api/settings/sop/subagents' && method === 'GET') {
      const { getAllSubAgentConfigsAsync } = await import('./config/sub-agents.js');
      const configs = await getAllSubAgentConfigsAsync();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ configs }));
      return;
    }

    // PUT /api/settings/sop/subagents/:type
    if (path.startsWith('/api/settings/sop/subagents/') && method === 'PUT') {
      const type = path.split('/')[4];
      const { saveSubAgentConfigToDb } = await import('./config/sub-agents.js');
      const body = await parseBody(req);
      await saveSubAgentConfigToDb(type, (body as { config: { personality: string; rules: string[]; skills: string[]; tools: string[] } }).config);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    // GET /api/settings/sop/llm
    if (path === '/api/settings/sop/llm' && method === 'GET') {
      const { DEFAULT_LLM_CONFIG } = await import('./config/llm.js');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ config: DEFAULT_LLM_CONFIG }));
      return;
    }

    // ── Debug: raw DB check ──
    // GET /api/debug/sop/:agentId/:sessionKey
    if (path.startsWith('/api/debug/sop/') && method === 'GET') {
      const parts = path.split('/');
      // ["", "api", "debug", "sop", "{agentId}", "{sessionKey}"]
      const agentId = parts[4] || '';
      const sessionKey = parts[5] ? decodeURIComponent(parts[5]) : '';
      // 使用新版格式查询
      const { getActiveSopTask } = await import('./agent-runtime/sop-v2.js');
      const state = await getActiveSopTask(agentId, sessionKey);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ found: !!state, state: state ? { taskId: state.taskId, taskName: state.taskName, currentStep: state.currentStep, status: state.status } : null }));
      return;
    }

    // ── SOP Progress ──
    // GET /api/sop/:agentId/:sessionKey/progress
    if (path.startsWith('/api/sop/') && method === 'GET') {
      const parts = path.split('/');
      // ["", "api", "sop", "{agentId}", "{sessionKey}", "progress"]
      if (parts.length >= 6 && parts[2] === 'sop') {
        const agentId = parts[3];
        const sessionKey = parts[4] ? decodeURIComponent(parts[4]) : '';
        const action = parts[5];
        if (action === 'progress' && agentId && sessionKey) {
          // 使用 getActiveSopTask 而不是 getSopState（后者需要 taskId）
          const { getActiveSopTask } = await import('./agent-runtime/sop-v2.js');
          const state = await getActiveSopTask(agentId, sessionKey);
          if (!state) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No active SOP' }));
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            taskId: state.taskId,
            taskName: state.taskName,
            currentStep: state.currentStep,
            totalSteps: state.steps.length,
            steps: state.steps,
            createdAt: state.createdAt,
          }));
          return;
        }
      }
    }

    // ── 飞书回调 ──
    // GET challenge 验证（飞书事件订阅配置时）
    if (path === '/api/webhooks/feishu' && method === 'GET') {
      const challenge = url.searchParams.get('challenge');
      if (challenge) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ challenge }));
        return;
      }
    }

// POST 飞书事件回调 / GET 按钮回调
    if (path === '/api/webhooks/feishu' && method === 'POST') {
      const { handleFeishuEvent } = await import('./routes/feishu-webhook.js');
      const result = await handleFeishuEvent(req);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (path === '/api/webhooks/feishu/approve' && method === 'GET') {
      const { handleApproveCallback } = await import('./routes/feishu-webhook.js');
      const result = await handleApproveCallback(url.searchParams);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // 404
    res.writeHead(404);
    res.end('Not found');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Invalid JSON')) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }
    console.error('[HTTP Error]', e);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: msg }));
  }
});

// ─── WebSocket ──────────────────────────────────────────────

const wss = new WebSocketServer({ server });
const wsClients = new Map<string, WebSocket>();
// 设置 wsClients 供 runtime 使用（避免循环导入）
import('./ws-push.js').then(m => m.setWsClients(wsClients));

wss.on('connection', (ws, req) => {
  // 支持 WS URL query 参数传递 api_key
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const qsApiKey = url.searchParams.get('api_key');
  if (qsApiKey) req.headers['authorization'] = `Bearer ${qsApiKey}`;

  // WebSocket 认证
  try {
    requireAuth(req as any);
  } catch {
    ws.send(JSON.stringify({ type: 'error', payload: { error: 'Unauthorized' } }));
    ws.close();
    return;
  }

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

        if (triggeredSkill) {
          // Skill 执行（非流式）
          const response = await executeSkill(triggeredSkill, agentId, { sessionKey, userMessage: message as string });
          ws.send(JSON.stringify({ type: 'response', payload: { response } }));
        } else {
          // Agent 流式输出
          await runAgentStream({ agentId, sessionKey, userMessage: message as string });
        }
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

  // 初始化审批规则（仅首次运行填充默认规则）
  try {
    const { seedDefaultRules } = await import('./agent-runtime/approval-rules.js');
    await seedDefaultRules();
  } catch (e) {
    console.error('[ApprovalRules] Seed failed:', e);
  }

  // 初始化数据库
  try {
    await query('SELECT 1');
    console.log('[DB] Connected');
  } catch (e) {
    console.error('[DB] Connection failed:', e);
    process.exit(1);
  }

  // 加载 DB 设置缓存
  try {
    const { refreshCache } = await import('./services/settings-cache.js');
    await refreshCache();
    console.log('[Settings] Cache loaded');
  } catch (e) {
    console.warn('[Settings] Cache load failed (will use env fallback):', e);
  }

  // 初始化 Trigger 引擎
  await initTriggerEngine();

  // 启动飞书长连接（无需公网 IP）- 仅在未配置webhook时启用
  const { getSetting, SETTINGS_KEYS } = await import('./services/settings.js');
  const feishuWebhookUrl = await getSetting(SETTINGS_KEYS.FEISHU_WEBHOOK_URL);
  if (!feishuWebhookUrl) {
    startLongPolling().catch(e => console.error('[FeishuLongPolling] Start error:', e));
  } else {
    console.log('[Feishu] Webhook mode enabled, skipping long polling');
  }

  server.listen(PORT, () => {
    console.log(`[ColoBot] Server running at http://localhost:${PORT}`);
    console.log(`[ColoBot] WebSocket at ws://localhost:${PORT}?agent_id=<id>&session=<key>`);
  });
}

main().catch(console.error);
