/**
 * 向量记忆 - 基于 pgvector
 */

import type { MemoryResult } from '@colobot/types';
import { query } from './db.js';
import { embed } from './embeddings.js';

/**
 * 保存记忆并生成向量
 */
export async function addMemory(
  agentId: string,
  key: string,
  value: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const { embedding } = await embed(value);
  if (!embedding) return;

  await query(
    `INSERT INTO agent_memory (agent_id, memory_key, memory_value, embedding, metadata)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (agent_id, memory_key) DO UPDATE SET
       memory_value = EXCLUDED.memory_value,
       embedding = EXCLUDED.embedding,
       metadata = EXCLUDED.metadata`,
    [agentId, key, value, JSON.stringify(embedding), JSON.stringify(metadata)]
  );
}

/**
 * 语义搜索记忆
 */
export async function searchMemory(
  agentId: string,
  queryText: string,
  topK = 5
): Promise<MemoryResult[]> {
  const { embedding } = await embed(queryText);
  if (!embedding?.length) return [];

  const rows = await query<{ id: string; memory_key: string; memory_value: string; metadata: Record<string, unknown>; created_at: Date; similarity: number }>(
    `SELECT id, memory_key, memory_value, metadata, created_at,
            (embedding <=> $2::vector) AS similarity
     FROM agent_memory
     WHERE agent_id = $1
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [agentId, JSON.stringify(embedding), topK]
  );

  return rows.map(r => ({
    id: r.id,
    content: r.memory_value,
    similarity: 1 - (r.similarity || 0),
    metadata: r.metadata,
    createdAt: r.created_at,
  }));
}

/**
 * 文本搜索（关键词匹配）
 */
export async function searchMemoryText(
  agentId: string,
  queryText: string,
  topK = 5
): Promise<MemoryResult[]> {
  const rows = await query<{ id: string; memory_key: string; memory_value: string; metadata: Record<string, unknown>; created_at: Date }>(
    `SELECT id, memory_key, memory_value, metadata, created_at
     FROM agent_memory
     WHERE agent_id = $1 AND memory_value ILIKE $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [agentId, `%${queryText.replace(/[%_]/g, '\\$&')}%`, topK]
  );

  return rows.map(r => ({
    id: r.id,
    content: r.memory_value,
    similarity: 1,
    metadata: r.metadata,
    createdAt: r.created_at,
  }));
}

/**
 * 列出所有记忆
 */
export async function listMemory(agentId: string): Promise<MemoryResult[]> {
  const rows = await query<{ id: string; memory_key: string; memory_value: string; metadata: Record<string, unknown>; created_at: Date }>(
    `SELECT id, memory_key, memory_value, metadata, created_at
     FROM agent_memory
     WHERE agent_id = $1
     ORDER BY created_at DESC`,
    [agentId]
  );

  return rows.map(r => ({
    id: r.id,
    content: r.memory_value,
    similarity: 1,
    metadata: r.metadata,
    createdAt: r.created_at,
  }));
}

/**
 * 混合搜索（向量 + 文本）
 */
export async function hybridSearch(
  agentId: string,
  queryText: string,
  topK = 5
): Promise<MemoryResult[]> {
  const vectorResults = await searchMemory(agentId, queryText, topK * 2);
  const textResults = await searchMemoryText(agentId, queryText, topK * 2);

  const seen = new Set<string>();
  const results: MemoryResult[] = [];

  for (const r of [...vectorResults, ...textResults]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      results.push(r);
    }
    if (results.length >= topK) break;
  }

  return results;
}
