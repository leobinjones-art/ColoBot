// ==================== 通用 ====================
export interface ApiResult<T = any> {
  code: number
  msg: string
  data: T
}

// ==================== 用户 ====================
export interface User {
  id: string | number
  username: string
  nickname: string
  avatar?: string
  role: 'admin' | 'user'
  enabled: boolean
}

// ==================== Agent ====================
export interface Agent {
  id: string | number
  name: string
  description?: string
  agentType: 'react' | 'plan_execute'
  systemPrompt?: string
  modelName?: string
  maxIterations: number
  enabled: boolean
  icon?: string
  tags?: string
}

// ==================== 会话与消息 ====================
export interface Conversation {
  conversationId: string
  title: string
  agentId: string | number
  messageCount: number
  streamStatus?: 'idle' | 'running'
  source?: string
  lastActiveTime?: string
}

export interface Message {
  id?: string | number
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  contentParts: MessageContentPart[]
  status?: 'generating' | 'completed' | 'stopped' | 'failed' | 'awaiting_approval'
  createTime?: string
  metadata?: MessageMetadata
}

export interface MessageContentPart {
  type: 'text' | 'thinking' | 'image' | 'file' | 'audio'
  text?: string
  fileUrl?: string
  fileName?: string
  contentType?: string
}

export interface MessageSegment {
  id: string
  type: 'thinking' | 'tool_call' | 'content' | 'phase' | 'approval'
  status: 'running' | 'completed' | 'error'
  thinkingText?: string
  toolName?: string
  toolArgs?: string
  toolResult?: string
  text?: string
}

export interface MessageMetadata {
  currentPhase?: string
  toolCalls?: ToolCallMeta[]
  segments?: MessageSegment[]
}

export interface ToolCallMeta {
  name: string
  arguments?: string
  status: 'running' | 'completed' | 'error' | 'awaiting_approval'
  result?: string
  success?: boolean
}

// ==================== 流控制 ====================
export type StreamPhase =
  | 'preparing_context'
  | 'reading_memory'
  | 'reasoning'
  | 'thinking'
  | 'streaming'
  | 'executing_tool'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'idle'

export interface QueuedMessage {
  content: string
  enqueuedAt: number
  status: 'queued' | 'sending' | 'cancelled'
  conversationId?: string
}

// ==================== 技能 ====================
export interface Skill {
  id: string | number
  name: string
  nameZh?: string
  nameEn?: string
  description?: string
  skillType: string
  icon?: string
  enabled: boolean
  securityScanStatus?: string
}

// ==================== 安全守护 ====================
export interface SentinelStatus {
  status: 'healthy' | 'warning' | 'critical'
  lastCheck: string
  agentsMonitored: number
  activeSessions: number
  recentTakeovers: number
}

export interface SentinelSession {
  sessionId: string
  agentId: string
  status: 'active' | 'timeout' | 'taken_over'
  lastHeartbeat: string
  currentPhase: string
}

// ==================== 个人助理 ====================
// 待办
export interface Todo {
  id: string | number
  userId: string
  title: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  status: 'pending' | 'doing' | 'done' | 'cancelled'
  dueDate?: string
  tags?: string[]
  createdAt: string
  completedAt?: string
}

// 提醒
export interface Reminder {
  id: string | number
  userId: string
  title: string
  content?: string
  remindAt: string
  repeat?: 'none' | 'daily' | 'weekly' | 'monthly'
  status: 'pending' | 'done' | 'cancelled'
  createdAt: string
}

// 日程
export interface Event {
  id: string | number
  userId: string
  title: string
  description?: string
  startAt: string
  endAt?: string
  location?: string
  repeat?: string
  createdAt: string
}

// 笔记
export interface Note {
  id: string | number
  userId: string
  title: string
  content?: string
  tags?: string[]
  createdAt: string
  updatedAt: string
}

// 习惯
export interface Habit {
  id: string | number
  userId: string
  name: string
  frequency: 'daily' | 'weekly' | 'monthly'
  createdAt: string
}

export interface HabitLog {
  id: string | number
  habitId: string | number
  loggedAt: string
  note?: string
}

// 心情
export interface Mood {
  id: string | number
  userId: string
  mood: 'happy' | 'sad' | 'neutral' | 'angry' | 'anxious'
  score: number
  note?: string
  loggedAt: string
}

// 财务
export interface Finance {
  id: string | number
  userId: string
  type: 'income' | 'expense'
  amount: number
  category?: string
  note?: string
  loggedAt: string
}

// 目标
export interface Goal {
  id: string | number
  userId: string
  title: string
  description?: string
  targetDate?: string
  progress: number
  status: 'active' | 'completed' | 'abandoned'
  createdAt: string
}

// 人脉
export interface Contact {
  id: string | number
  userId: string
  name: string
  organization?: string
  role?: string
  email?: string
  phone?: string
  tags?: string[]
  lastContact?: string
  note?: string
  createdAt: string
}

// ==================== 意图识别 ====================
export interface Intent {
  type: string
  confidence: number
  slots?: Record<string, any>
}

// ==================== 通用分页 ====================
export interface PageResult<T> {
  records: T[]
  total: number
  size: number
  current: number
}
