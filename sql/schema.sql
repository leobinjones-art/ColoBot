-- ColoBot Database Schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Agents 表
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  soul_content TEXT NOT NULL DEFAULT '{}',
  memory_content TEXT NOT NULL DEFAULT '{}',
  workspace_path TEXT NOT NULL,
  primary_model_id VARCHAR(255) DEFAULT NULL,
  fallback_model_id VARCHAR(255) DEFAULT NULL,
  temperature FLOAT DEFAULT 0.7,
  max_tokens INT DEFAULT 4096,
  context_window_size INT DEFAULT 100,
  max_tool_rounds INT DEFAULT 50,
  system_prompt_override TEXT DEFAULT NULL,
  status VARCHAR(50) DEFAULT 'idle',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent 会话
CREATE TABLE IF NOT EXISTS agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  session_key VARCHAR(500) NOT NULL,
  context JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_sessions_key ON agent_sessions(agent_id, session_key);

-- Skill 模式检测
CREATE TABLE IF NOT EXISTS skill_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  agent_name VARCHAR(255) NOT NULL,
  pattern VARCHAR(500) NOT NULL,
  tool_sequence JSONB NOT NULL DEFAULT '[]',
  conversation TEXT,
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skill_patterns_agent ON skill_patterns(agent_id);

-- Skill 提案
CREATE TABLE IF NOT EXISTS skill_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES skill_patterns(id) ON DELETE SET NULL,
  skill_name VARCHAR(255) NOT NULL,
  pattern TEXT NOT NULL,
  tool_sequence JSONB NOT NULL DEFAULT '[]',
  markdown_content TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  decided_at TIMESTAMP WITH TIME ZONE,
  approver VARCHAR(255),
  reject_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_skill_proposals_status ON skill_proposals(status);

-- Skill 库
CREATE TABLE IF NOT EXISTS skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  markdown_content TEXT NOT NULL,
  trigger_words JSONB DEFAULT '[]',
  trigger_config JSONB DEFAULT '{}',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_skills_enabled ON skills(enabled);

-- Skill 待审批
CREATE TABLE IF NOT EXISTS pending_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name VARCHAR(255) NOT NULL,
  markdown_content TEXT NOT NULL,
  trigger_words JSONB DEFAULT '[]',
  trigger_config JSONB DEFAULT '{}',
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_skills_status ON pending_skills(status);

-- Triggers
CREATE TABLE IF NOT EXISTS triggers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE SET NULL,
  type VARCHAR(50) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  active BOOLEAN DEFAULT TRUE,
  last_fired_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_agent ON triggers(agent_id);
CREATE INDEX IF NOT EXISTS idx_triggers_active ON triggers(active);

-- Trigger 历史
CREATE TABLE IF NOT EXISTS trigger_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_id UUID NOT NULL REFERENCES triggers(id) ON DELETE CASCADE,
  fired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  result JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_trigger_history_trigger_id ON trigger_history(trigger_id);

-- 向量记忆
CREATE TABLE IF NOT EXISTS agent_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  memory_key VARCHAR(255) NOT NULL,
  memory_value TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_agent_id ON agent_memory(agent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_memory_key ON agent_memory(agent_id, memory_key);

-- 审批请求
CREATE TABLE IF NOT EXISTS approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  requester VARCHAR(255) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  target_resource VARCHAR(500) NOT NULL,
  description TEXT,
  payload JSONB DEFAULT '{}',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  decided_at TIMESTAMP WITH TIME ZONE,
  approver VARCHAR(255),
  result JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);

-- 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type VARCHAR(50) NOT NULL,
  actor_id VARCHAR(255),
  actor_name VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id VARCHAR(255),
  target_name VARCHAR(255),
  detail JSONB DEFAULT '{}',
  ip_address VARCHAR(45),
  channel VARCHAR(50),
  result VARCHAR(20) NOT NULL DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 审批日志（活动记录）
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  summary VARCHAR(500) NOT NULL DEFAULT '',
  detail JSONB DEFAULT '{}',
  related_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_agent ON activity_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);
