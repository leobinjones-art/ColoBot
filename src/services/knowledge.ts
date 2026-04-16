/**
 * 知识库服务
 */
import { query, queryOne } from '../memory/db.js';

export type KnowledgeCategory = 'concept' | 'template' | 'rule';

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  name: string;
  content: string;
  variables: string[];
  related: string[];
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export async function addKnowledge(data: {
  category: KnowledgeCategory;
  name: string;
  content: string;
  variables?: string[];
  related?: string[];
  metadata?: Record<string, unknown>;
}): Promise<KnowledgeEntry> {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO knowledge_base (id, category, name, content, variables, related, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (category, name) DO UPDATE SET
       content = $4, variables = $5, related = $6, metadata = $7, updated_at = NOW()`,
    [id, data.category, data.name, data.content, JSON.stringify(data.variables ?? []), JSON.stringify(data.related ?? []), JSON.stringify(data.metadata ?? {})]
  );
  return (await getKnowledge(data.category, data.name))!;
}

export async function getKnowledge(category: KnowledgeCategory, name: string): Promise<KnowledgeEntry | null> {
  const row = await queryOne<{
    id: string; category: string; name: string; content: string;
    variables: string; related: string; metadata: string; created_at: Date; updated_at: Date;
  }>('SELECT * FROM knowledge_base WHERE category = $1 AND name = $2', [category, name]);
  if (!row) return null;
  return {
    ...row,
    category: row.category as KnowledgeCategory,
    variables: JSON.parse(row.variables),
    related: JSON.parse(row.related),
    metadata: JSON.parse(row.metadata),
  };
}

export async function listKnowledge(category?: KnowledgeCategory): Promise<KnowledgeEntry[]> {
  type Row = { id: string; category: string; name: string; content: string; variables: string; related: string; metadata: string; created_at: Date; updated_at: Date };
  const rows: Row[] = category
    ? await query('SELECT * FROM knowledge_base WHERE category = $1 ORDER BY name', [category])
    : await query('SELECT * FROM knowledge_base ORDER BY category, name');
  return rows.map(row => ({
    id: row.id,
    category: row.category as KnowledgeCategory,
    name: row.name,
    content: row.content,
    variables: JSON.parse(row.variables),
    related: JSON.parse(row.related),
    metadata: JSON.parse(row.metadata),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function searchKnowledge(queryText: string, category?: KnowledgeCategory): Promise<KnowledgeEntry[]> {
  type Row = { id: string; category: string; name: string; content: string; variables: string; related: string; metadata: string; created_at: Date; updated_at: Date };
  const escaped = queryText.replace(/[%_]/g, '\\$&');
  const pattern = `%${escaped}%`;
  const rows: Row[] = category
    ? await query(`SELECT * FROM knowledge_base WHERE category = $1 AND (name ILIKE $2 OR content ILIKE $2) ORDER BY name`, [category, pattern])
    : await query(`SELECT * FROM knowledge_base WHERE name ILIKE $1 OR content ILIKE $1 ORDER BY name`, [pattern]);
  return rows.map(row => ({
    id: row.id,
    category: row.category as KnowledgeCategory,
    name: row.name,
    content: row.content,
    variables: JSON.parse(row.variables),
    related: JSON.parse(row.related),
    metadata: JSON.parse(row.metadata),
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

export async function deleteKnowledge(category: KnowledgeCategory, name: string): Promise<void> {
  await query('DELETE FROM knowledge_base WHERE category = $1 AND name = $2', [category, name]);
}
