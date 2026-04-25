/**
 * Agent 相关类型
 */

// 子代理类型
export type SubAgentType = 'search' | 'analysis' | 'writing' | 'review' | 'general';

// 子代理配置
export interface SubAgentConfig {
  type: SubAgentType;
  name: string;
  description: string;
  systemPrompt: string;
  tools?: string[];
  ttlMs?: number;
  maxTokens?: number;
}

// 技能定义
export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  tools: string[];
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 审批状态
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

// 审批请求
export interface ApprovalRequest {
  id: string;
  agentId: string;
  requester: string;
  channel: string;
  actionType: string;
  targetResource: string;
  status: ApprovalStatus;
  createdAt: Date;
  expiresAt: Date;
}
