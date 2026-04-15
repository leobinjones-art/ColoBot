/**
 * 记忆工具
 */
import { searchMemory, addMemory, hybridSearch } from '../../memory/vector.js';
import { registerTool } from './executor.js';

export function registerTools(): void {
  registerTool('search_memory', async (args) => {
    const { agent_id, query, top_k } = args as { agent_id: string; query: string; top_k?: number };
    return hybridSearch(agent_id, query, top_k ?? 5);
  });

  registerTool('add_memory', async (args) => {
    const { agent_id, key, value, metadata } = args as {
      agent_id: string;
      key: string;
      value: string;
      metadata?: Record<string, unknown>;
    };
    await addMemory(agent_id, key, value, metadata ?? {});
    return { ok: true };
  });

  registerTool('list_memory', async (args) => {
    const { agent_id } = args as { agent_id: string };
    const { listMemory } = await import('../../memory/vector.js');
    return listMemory(agent_id);
  });
}
