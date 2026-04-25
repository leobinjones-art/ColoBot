/**
 * Service 相关类型
 */

// 用户角色
export type UserRole = 'student' | 'researcher' | 'developer' | 'writer' | 'other';
export type ExpertiseLevel = 'beginner' | 'intermediate' | 'expert';

// 用户档案
export interface UserProfile {
  id: string;
  userId: string;
  role: UserRole;
  expertiseLevel: ExpertiseLevel;
  interests: string[];
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// 信任级别
export type TrustLevel = 'high' | 'medium' | 'low';

// 内容来源
export interface ContentSource {
  type: 'user' | 'agent' | 'external';
  id: string;
  trustLevel: TrustLevel;
}

// 内容验证结果
export interface ContentValidationResult {
  valid: boolean;
  threats: string[];
  trustLevel: TrustLevel;
  reason?: string;
}

// 通知载荷
export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// 通知适配器
export interface NotificationAdapter {
  name: string;
  send(payload: NotificationPayload, target: string): Promise<void>;
}

// 审计日志
export interface AuditEntry {
  id: string;
  agentId: string;
  action: string;
  resource: string;
  result: 'success' | 'failure';
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

// 应用设置
export interface AppSetting {
  key: string;
  value: string;
  description?: string;
  updatedAt: Date;
}
