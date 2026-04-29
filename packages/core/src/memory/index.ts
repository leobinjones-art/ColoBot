/**
 * Memory 模块导出
 */

export { initDb, query, queryOne, closeDb, getPool, type DbConfig } from './db.js'
export { embed, configureEmbedding, type EmbeddingConfig } from './embeddings.js'
export { addMemory, searchMemory, searchMemoryText, listMemory, hybridSearch } from './vector.js'

// 分层记忆
export {
  initLayeredMemoryTables,
  addLongTermMemory,
  searchLongTermMemory,
  getUserProfile,
  addEpisodicMemory,
  searchEpisodicMemory,
  applyDecay,
  addWorkingMemory,
  getWorkingMemory,
  clearWorkingMemory,
  searchAllMemory,
  getMemoryContext,
  type MemoryLayer,
  type LongTermType,
  type LongTermMemory,
  type EpisodicMemory,
  type WorkingMemory,
  type MemorySearchResult,
} from './layered.js'
