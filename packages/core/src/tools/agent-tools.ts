/**
 * Agent 管理工具
 */

import type { ToolContext } from '@colobot/types';
import { toolRegistry } from './registry.js';
import { agentRegistry } from '../agents/registry.js';

async function deleteAgent(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const { agent_id } = args as { agent_id: string };
  if (!agent_id) throw new Error('agent_id is required');

  const agent = await agentRegistry.get(agent_id);
  if (!agent) throw new Error(`Agent not found: ${agent_id}`);

  await agentRegistry.delete(agent_id);
  return JSON.stringify({ ok: true, deleted: agent_id, name: agent.name });
}

async function updateAgent(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
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
    primary_model_id,
    fallback_model_id,
    temperature,
    max_tokens,
    max_tool_rounds,
    system_prompt_override,
  });

  return JSON.stringify({ ok: true, updated: agent_id, name: agent.name });
}

async function listAgents(_args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const agents = await agentRegistry.list();
  return JSON.stringify(agents.map(a => ({
    id: a.id,
    name: a.name,
    status: a.status,
    primary_model_id: a.primary_model_id,
  })), null, 2);
}

async function getAgent(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const { agent_id } = args as { agent_id: string };
  if (!agent_id) throw new Error('agent_id is required');

  const agent = await agentRegistry.get(agent_id);
  if (!agent) throw new Error(`Agent not found: ${agent_id}`);

  return JSON.stringify(agent, null, 2);
}

export function registerAgentTools(): void {
  toolRegistry.register({
    name: 'delete_agent',
    description: 'Delete an agent by ID',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID to delete' },
      },
      required: ['agent_id'],
    },
    execute: deleteAgent,
  });

  toolRegistry.register({
    name: 'update_agent',
    description: 'Update agent settings',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID to update' },
        primary_model_id: { type: 'string', description: 'Primary model ID' },
        fallback_model_id: { type: 'string', description: 'Fallback model ID' },
        temperature: { type: 'number', description: 'Temperature setting' },
        max_tokens: { type: 'number', description: 'Max tokens' },
        max_tool_rounds: { type: 'number', description: 'Max tool rounds' },
        system_prompt_override: { type: 'string', description: 'System prompt override' },
      },
      required: ['agent_id'],
    },
    execute: updateAgent,
  });

  toolRegistry.register({
    name: 'list_agents',
    description: 'List all agents',
    parameters: { type: 'object', properties: {} },
    execute: listAgents,
  });

  toolRegistry.register({
    name: 'get_agent',
    description: 'Get agent details by ID',
    parameters: {
      type: 'object',
      properties: {
        agent_id: { type: 'string', description: 'Agent ID' },
      },
      required: ['agent_id'],
    },
    execute: getAgent,
  });
}
