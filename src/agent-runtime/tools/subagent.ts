/**
 * 子Agent工具
 */
import { registerTool } from './executor.js';

export function registerTools(): void {
  registerTool('delegate_task', async (args) => {
    const { sub_agent_id, task } = args as { sub_agent_id: string; task: string };
    const { runSubAgentTask, getSubAgent } = await import('../sub-agents.js');
    const agent = getSubAgent(sub_agent_id);
    if (!agent) throw new Error(`SubAgent not found: ${sub_agent_id}`);
    return runSubAgentTask(agent, task, agent.parentId);
  });

  registerTool('spawn_subagent', async (args) => {
    const { name, soul_content, parent_id, ttl_ms, allowed_tools } = args as {
      name: string;
      soul_content: string;
      parent_id: string;
      ttl_ms?: number;
      allowed_tools?: string[];
    };
    const { spawnSubAgent } = await import('../sub-agents.js');
    const agent = spawnSubAgent({
      name,
      soul_content,
      parentId: parent_id,
      ttlMs: ttl_ms,
      allowedTools: allowed_tools,
    });
    return { id: agent.id, name: agent.name };
  });
}
