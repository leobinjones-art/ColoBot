/**
 * Agent 管理工具 - delete_agent / update_agent
 *
 * delete_agent: 删除指定 Agent（需要审批，action_type: delete）
 * update_agent: 更新 Agent 配置（需要审批，action_type: update）
 */

import { registerTool } from './executor.js';
import { agentRegistry } from '../../agents/registry.js';

function register() {
  registerTool('delete_agent', async (args) => {
    const { agent_id } = args as { agent_id: string };
    if (!agent_id) throw new Error('agent_id is required');

    const agent = await agentRegistry.get(agent_id);
    if (!agent) throw new Error(`Agent not found: ${agent_id}`);

    await agentRegistry.delete(agent_id);
    return { ok: true, deleted: agent_id, name: agent.name };
  });

  registerTool('update_agent', async (args) => {
    const {
      agent_id,
      primary_model_id,
      fallback_model_id,
      temperature,
      max_tokens,
      max_tool_rounds,
      system_prompt_override,
    } = args as {
      agent_id: string;
      primary_model_id?: string;
      fallback_model_id?: string;
      temperature?: number;
      max_tokens?: number;
      max_tool_rounds?: number;
      system_prompt_override?: string;
    };

    if (!agent_id) throw new Error('agent_id is required');

    const agent = await agentRegistry.get(agent_id);
    if (!agent) throw new Error(`Agent not found: ${agent_id}`);

    await agentRegistry.updateSettings(agent_id, {
      primary_model_id: primary_model_id ?? undefined,
      fallback_model_id: fallback_model_id ?? undefined,
      temperature: temperature ?? undefined,
      max_tokens: max_tokens ?? undefined,
      max_tool_rounds: max_tool_rounds ?? undefined,
      system_prompt_override: system_prompt_override ?? undefined,
    });

    return { ok: true, updated: agent_id, name: agent.name };
  });
}

export function registerTools(): void {
  register();
}
