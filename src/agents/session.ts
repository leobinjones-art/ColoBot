/**
 * 会话管理 - Agent 消息会话
 */

import { query, queryOne } from '../memory/db.js';

export interface Session {
  id: string;
  agent_id: string;
  session_key: string;
  context: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

interface SessionRow {
  id: string;
  agent_id: string;
  session_key: string;
  context: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

class SessionManager {
  /** 获取会话 */
  async get(agentId: string, sessionKey: string): Promise<Session | null> {
    const row = await queryOne<SessionRow>(
      'SELECT * FROM agent_sessions WHERE agent_id = $1 AND session_key = $2',
      [agentId, sessionKey]
    );
    return row ? this.parseRow(row) : null;
  }

  /** 获取或创建会话 */
  async getOrCreate(agentId: string, sessionKey: string): Promise<Session> {
    let session = await this.get(agentId, sessionKey);
    if (!session) {
      const id = crypto.randomUUID();
      await query(
        `INSERT INTO agent_sessions (id, agent_id, session_key, context)
         VALUES ($1, $2, $3, '{}')`,
        [id, agentId, sessionKey]
      );
      session = await this.get(agentId, sessionKey);
    }
    return session!;
  }

  /** 更新会话上下文 */
  async updateContext(
    agentId: string,
    sessionKey: string,
    context: Record<string, unknown>
  ): Promise<void> {
    await query(
      `UPDATE agent_sessions SET context = $1, updated_at = NOW()
       WHERE agent_id = $2 AND session_key = $3`,
      [JSON.stringify(context), agentId, sessionKey]
    );
  }

  /** 追加历史消息 */
  async appendMessage(
    agentId: string,
    sessionKey: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<void> {
    const session = await this.getOrCreate(agentId, sessionKey);
    const history = (session.context.history as Array<{ role: string; content: string }>) || [];
    history.push({ role, content });
    // 保留最近 20 条
    const trimmed = history.slice(-20);
    await this.updateContext(agentId, sessionKey, { ...session.context, history: trimmed });
  }

  /** 获取历史消息 */
  async getHistory(agentId: string, sessionKey: string): Promise<Array<{ role: string; content: string }>> {
    const session = await this.get(agentId, sessionKey);
    return (session?.context?.history as Array<{ role: string; content: string }>) || [];
  }

  private parseRow(r: SessionRow): Session {
    return {
      id: r.id,
      agent_id: r.agent_id,
      session_key: r.session_key,
      context: typeof r.context === 'string' ? JSON.parse(r.context) : (r.context || {}),
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }
}

export const sessionManager = new SessionManager();
