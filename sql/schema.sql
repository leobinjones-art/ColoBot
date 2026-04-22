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
  next_fire_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_triggers_agent ON triggers(agent_id);
CREATE INDEX IF NOT EXISTS idx_triggers_active ON triggers(active);
CREATE INDEX IF NOT EXISTS idx_triggers_next_fire ON triggers(next_fire_at) WHERE active = true;

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

-- 审批规则（Tirith 规则引擎）
CREATE TABLE IF NOT EXISTS approval_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  pattern TEXT NOT NULL,
  pattern_type VARCHAR(20) NOT NULL DEFAULT 'keyword',
  action VARCHAR(20) NOT NULL DEFAULT 'require_approval',
  risk_level VARCHAR(20) NOT NULL DEFAULT 'medium',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- 自进化置信度（基于用户历史行为）
  user_approve_count INT NOT NULL DEFAULT 0,
  user_reject_count INT NOT NULL DEFAULT 0,
  auto_approve_threshold INT NOT NULL DEFAULT 3,
  auto_reject_threshold INT NOT NULL DEFAULT 3,
  confidence_decay_days INT NOT NULL DEFAULT 14,
  last_decided_at TIMESTAMP WITH TIME ZONE,
  priority INT NOT NULL DEFAULT 100  -- 越小优先级越高，0=最高
);

-- 迁移：为已存在的 approval_rules 表添加自进化字段（幂等）
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_rules' AND column_name = 'user_approve_count') THEN
    ALTER TABLE approval_rules ADD COLUMN user_approve_count INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_rules' AND column_name = 'user_reject_count') THEN
    ALTER TABLE approval_rules ADD COLUMN user_reject_count INT NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_rules' AND column_name = 'auto_approve_threshold') THEN
    ALTER TABLE approval_rules ADD COLUMN auto_approve_threshold INT NOT NULL DEFAULT 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_rules' AND column_name = 'auto_reject_threshold') THEN
    ALTER TABLE approval_rules ADD COLUMN auto_reject_threshold INT NOT NULL DEFAULT 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_rules' AND column_name = 'confidence_decay_days') THEN
    ALTER TABLE approval_rules ADD COLUMN confidence_decay_days INT NOT NULL DEFAULT 14;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_rules' AND column_name = 'last_decided_at') THEN
    ALTER TABLE approval_rules ADD COLUMN last_decided_at TIMESTAMP WITH TIME ZONE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'approval_rules' AND column_name = 'priority') THEN
    ALTER TABLE approval_rules ADD COLUMN priority INT NOT NULL DEFAULT 100;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_approval_rules_enabled ON approval_rules(enabled);

-- 审批规则命中历史（用于 Pattern 匹配）
CREATE TABLE IF NOT EXISTS approval_rule_hits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES approval_rules(id) ON DELETE SET NULL,
  tool_name VARCHAR(100) NOT NULL,
  args_text TEXT NOT NULL,
  hit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_rule_hits_tool ON approval_rule_hits(tool_name);
CREATE INDEX IF NOT EXISTS idx_approval_rule_hits_recent ON approval_rule_hits(hit_at DESC);

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

-- Soul 自进化提案
CREATE TABLE IF NOT EXISTS soul_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  soul_diff TEXT NOT NULL,
  proposed_soul TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  decided_at TIMESTAMP WITH TIME ZONE,
  approver VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS idx_soul_proposals_agent ON soul_proposals(agent_id);
CREATE INDEX IF NOT EXISTS idx_soul_proposals_status ON soul_proposals(status);

-- 待继续的对话（危险工具审批中，LLM 状态暂存）
CREATE TABLE IF NOT EXISTS pending_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id UUID NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  session_key VARCHAR(500) NOT NULL,
  messages JSONB NOT NULL,
  dangerous_calls JSONB NOT NULL,
  current_round INT NOT NULL DEFAULT 1,
  allowed_calls JSONB DEFAULT '[]',
  blocked_calls JSONB DEFAULT '[]',
  ip_address VARCHAR(45),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_conversations_approval ON pending_conversations(approval_id);
CREATE INDEX IF NOT EXISTS idx_pending_conversations_agent ON pending_conversations(agent_id);

-- 全局配置（飞书/API Key 等）
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 知识库
CREATE TABLE IF NOT EXISTS knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  related JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_base_category ON knowledge_base(category);
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_base_unique ON knowledge_base(category, name);

-- 用户画像
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL UNIQUE REFERENCES agents(id) ON DELETE CASCADE,

  -- 基本信息
  name VARCHAR(255),
  role VARCHAR(50),
  organization VARCHAR(255),
  bio TEXT,

  -- 专业背景
  expertise_level VARCHAR(50),
  research_fields JSONB DEFAULT '[]',
  skills JSONB DEFAULT '[]',
  languages JSONB DEFAULT '[]',

  -- 偏好设置
  communication_style VARCHAR(50),
  response_length VARCHAR(50),
  preferred_language VARCHAR(50),

  -- 目标与项目
  goals JSONB DEFAULT '[]',
  current_projects JSONB DEFAULT '[]',

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_agent ON user_profiles(agent_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
