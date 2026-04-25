/**
 * Memory 相关类型
 */

// 嵌入结果
export interface EmbedResult {
  embedding: number[] | null;
  model: string;
  tokens: number;
}

// 记忆结果
export interface MemoryResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
  createdAt: Date;
}

// 知识条目
export type KnowledgeCategory = 'concept' | 'template' | 'rule';

export interface KnowledgeEntry {
  id: string;
  category: KnowledgeCategory;
  key: string;
  value: string;
  embedding?: number[];
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
