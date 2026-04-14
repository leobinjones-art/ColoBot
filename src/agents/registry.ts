/**
 * Agent 注册表 - 简化版，只有父Agent
 */

import { query, queryOne } from '../memory/db.js';

export interface Agent {
  id: string;
  name: string;
  soul_content: string;
  memory_content: string;
  workspace_path: string;
  primary_model_id: string | null;
  fallback_model_id: string | null;
  temperature: number;
  max_tokens: number;
  context_window_size: number;
  max_tool_rounds: number;
  system_prompt_override: string | null;
  status: 'idle' | 'active' | 'stopped';
  created_at: Date;
  updated_at: Date;
}

export interface AgentCreate {
  name: string;
  soul_content?: string;
  primary_model_id?: string;
  fallback_model_id?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt_override?: string;
}

interface AgentRow {
  id: string;
  name: string;
  soul_content: string;
  memory_content: string;
  workspace_path: string;
  primary_model_id: string | null;
  fallback_model_id: string | null;
  temperature: number;
  max_tokens: number;
  context_window_size: number;
  max_tool_rounds: number;
  system_prompt_override: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

function parseSoul(soulContent: string): { role?: string; personality?: string; rules?: string[] } {
  try {
    return JSON.parse(soulContent || '{}');
  } catch {
    return {};
  }
}

class AgentRegistry {
  /** 列出所有 Agent */
  async list(): Promise<Agent[]> {
    const rows = await query<AgentRow>('SELECT * FROM agents ORDER BY created_at DESC');
    return rows.map(r => this.parseRow(r));
  }

  /** 获取单个 Agent */
  async get(id: string): Promise<Agent | null> {
    const row = await queryOne<AgentRow>('SELECT * FROM agents WHERE id = $1', [id]);
    return row ? this.parseRow(row) : null;
  }

  /** 按名称获取 */
  async getByName(name: string): Promise<Agent | null> {
    const row = await queryOne<AgentRow>('SELECT * FROM agents WHERE name = $1', [name]);
    return row ? this.parseRow(row) : null;
  }

  /** 创建 Agent */
  async create(input: AgentCreate): Promise<Agent> {
    const id = crypto.randomUUID();
    const soul = input.soul_content || JSON.stringify({ role: input.name, personality: '' });

    await query(
      `INSERT INTO agents (id, name, soul_content, workspace_path, primary_model_id, fallback_model_id, temperature, max_tokens, system_prompt_override)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        input.name,
        soul,
        `/workspace/${input.name}`,
        input.primary_model_id || null,
        input.fallback_model_id || null,
        input.temperature ?? 0.7,
        input.max_tokens ?? 4096,
        input.system_prompt_override || null,
      ]
    );

    const agent = await this.get(id);
    if (!agent) throw new Error('Failed to create agent');
    return agent;
  }

  /** 更新 Agent 设置 */
  async updateSettings(
    id: string,
    settings: Partial<{
      primary_model_id: string | null;
      fallback_model_id: string | null;
      temperature: number;
      max_tokens: number;
      max_tool_rounds: number;
      system_prompt_override: string | null;
    }>
  ): Promise<void> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (settings.primary_model_id !== undefined) {
      fields.push(`primary_model_id = $${i++}`);
      values.push(settings.primary_model_id);
    }
    if (settings.fallback_model_id !== undefined) {
      fields.push(`fallback_model_id = $${i++}`);
      values.push(settings.fallback_model_id);
    }
    if (settings.temperature !== undefined) {
      fields.push(`temperature = $${i++}`);
      values.push(settings.temperature);
    }
    if (settings.max_tokens !== undefined) {
      fields.push(`max_tokens = $${i++}`);
      values.push(settings.max_tokens);
    }
    if (settings.max_tool_rounds !== undefined) {
      fields.push(`max_tool_rounds = $${i++}`);
      values.push(settings.max_tool_rounds);
    }
    if (settings.system_prompt_override !== undefined) {
      fields.push(`system_prompt_override = $${i++}`);
      values.push(settings.system_prompt_override);
    }

    if (fields.length === 0) return;

    fields.push(`updated_at = NOW()`);
    values.push(id);

    await query(
      `UPDATE agents SET ${fields.join(', ')} WHERE id = $${i}`,
      values
    );
  }

  /** 更新 Soul */
  async updateSoul(id: string, soulContent: string): Promise<void> {
    await query('UPDATE agents SET soul_content = $1, updated_at = NOW() WHERE id = $2', [soulContent, id]);
  }

  /** 更新状态 */
  async setStatus(id: string, status: Agent['status']): Promise<void> {
    await query('UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
  }

  /** 删除 Agent */
  async delete(id: string): Promise<void> {
    await query('DELETE FROM agents WHERE id = $1', [id]);
  }

  /** 解析 Soul JSON */
  parseSoul(soulContent: string): { role?: string; personality?: string; rules?: string[] } {
    return parseSoul(soulContent);
  }

  private parseRow(r: AgentRow): Agent {
    return {
      id: r.id,
      name: r.name,
      soul_content: r.soul_content,
      memory_content: r.memory_content,
      workspace_path: r.workspace_path,
      primary_model_id: r.primary_model_id,
      fallback_model_id: r.fallback_model_id,
      temperature: r.temperature,
      max_tokens: r.max_tokens,
      context_window_size: r.context_window_size,
      max_tool_rounds: r.max_tool_rounds,
      system_prompt_override: r.system_prompt_override,
      status: r.status as Agent['status'],
      created_at: r.created_at,
      updated_at: r.updated_at,
    };
  }
}

export const agentRegistry = new AgentRegistry();
