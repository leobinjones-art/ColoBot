/**
 * 语义空间记忆 - SQLite Schema
 */

export const SPACE_SCHEMA = `
-- 记忆节点
CREATE TABLE IF NOT EXISTS space_nodes (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  embedding BLOB,
  room_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  access_count INTEGER NOT NULL DEFAULT 0,
  last_accessed INTEGER NOT NULL,
  importance REAL NOT NULL DEFAULT 0.5,
  source_id TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  compressed_content TEXT,
  lifecycle TEXT NOT NULL DEFAULT 'active' CHECK(lifecycle IN ('active','sealed','archived')),
  FOREIGN KEY (room_id) REFERENCES space_rooms(id)
);

-- 房间
CREATE TABLE IF NOT EXISTS space_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  centroid BLOB,
  summary TEXT,
  node_count INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  last_activity INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  parent_room_id TEXT,
  FOREIGN KEY (parent_room_id) REFERENCES space_rooms(id)
);

-- 走廊 (房间关联)
CREATE TABLE IF NOT EXISTS space_corridors (
  id TEXT PRIMARY KEY,
  from_room_id TEXT NOT NULL,
  to_room_id TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 0.5,
  shared_tags TEXT NOT NULL DEFAULT '[]',
  FOREIGN KEY (from_room_id) REFERENCES space_rooms(id),
  FOREIGN KEY (to_room_id) REFERENCES space_rooms(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_space_nodes_room ON space_nodes(room_id);
CREATE INDEX IF NOT EXISTS idx_space_nodes_lifecycle ON space_nodes(lifecycle);
CREATE INDEX IF NOT EXISTS idx_space_nodes_time ON space_nodes(timestamp);
CREATE INDEX IF NOT EXISTS idx_space_rooms_active ON space_rooms(is_active);
CREATE INDEX IF NOT EXISTS idx_space_corridors_from ON space_corridors(from_room_id);
CREATE INDEX IF NOT EXISTS idx_space_corridors_to ON space_corridors(to_room_id);
`
