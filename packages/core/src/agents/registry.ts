/**
 * Agent 注册表
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

export interface AgentUpdate {
  primary_model_id?: string;
  fallback_model_id?: string;
  temperature?: number;
  max_tokens?: number;
  max_tool_rounds?: number;
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

class AgentRegistry {
  async list(): Promise<Agent[]> {
    const rows = await query<AgentRow>('SELECT * FROM agents ORDER BY created_at DESC');
    return rows.map(r => this.parseRow(r));
  }

  async get(id: string): Promise<Agent | null> {
    const row = await queryOne<AgentRow>('SELECT * FROM agents WHERE id = $1', [id]);
    return row ? this.parseRow(row) : null;
  }

  async getByName(name: string): Promise<Agent | null> {
    const row = await queryOne<AgentRow>('SELECT * FROM agents WHERE name = $1', [name]);
    return row ? this.parseRow(row) : null;
  }

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

    return (await this.get(id))!;
  }

  async updateSettings(id: string, settings: AgentUpdate): Promise<void> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (settings.primary_model_id !== undefined) {
      updates.push(`primary_model_id = $${paramIndex++}`);
      values.push(settings.primary_model_id);
    }
    if (settings.fallback_model_id !== undefined) {
      updates.push(`fallback_model_id = $${paramIndex++}`);
      values.push(settings.fallback_model_id);
    }
    if (settings.temperature !== undefined) {
      updates.push(`temperature = $${paramIndex++}`);
      values.push(settings.temperature);
    }
    if (settings.max_tokens !== undefined) {
      updates.push(`max_tokens = $${paramIndex++}`);
      values.push(settings.max_tokens);
    }
    if (settings.max_tool_rounds !== undefined) {
      updates.push(`max_tool_rounds = $${paramIndex++}`);
      values.push(settings.max_tool_rounds);
    }
    if (settings.system_prompt_override !== undefined) {
      updates.push(`system_prompt_override = $${paramIndex++}`);
      values.push(settings.system_prompt_override);
    }

    if (updates.length === 0) return;

    updates.push('updated_at = NOW()');
    values.push(id);

    await query(`UPDATE agents SET ${updates.join(', ')} WHERE id = $${paramIndex}`, values);
  }

  async delete(id: string): Promise<void> {
    await query('DELETE FROM agents WHERE id = $1', [id]);
  }

  private parseRow(row: AgentRow): Agent {
    return {
      ...row,
      status: row.status as 'idle' | 'active' | 'stopped',
    };
  }
}

export const agentRegistry = new AgentRegistry();
