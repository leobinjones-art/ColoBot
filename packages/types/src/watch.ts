/**
 * Watch App 类型定义
 */

/**
 * Sentinel 健康状态
 */
export interface SentinelHealthStatus {
  status: 'healthy' | 'degraded' | 'dead'
  eventLoopLag: number // milliseconds
  lastBeat: number // timestamp
}

/**
 * Sentinel 运行状态
 */
export interface SentinelStatus {
  enabled: boolean
  mode: 'active' | 'standby' | 'disabled'
  healthStatus: SentinelHealthStatus
  activeSessions: number
  blockedToday: number
  lastAlert?: number
}

/**
 * Agent 健康状态
 */
export interface AgentHealthStatus {
  id: string
  name?: string
  status: 'healthy' | 'unhealthy' | 'dead'
  lastHeartbeat: number
  missedBeats: number
  sessionCount: number
  avgResponseTime?: number
}

/**
 * Watch 会话状态
 */
export interface WatchSessionState {
  id: string // sessionId
  agentId: string
  agentName?: string
  status: 'idle' | 'processing' | 'blocked' | 'error'
  currentTask?: string
  taskProgress: number // 0-100
  lastActivity: number
  timeoutStage?: 'normal' | 'warning' | 'prompt' | 'takeover'
}

/**
 * 快捷指令
 */
export interface QuickCommand {
  id: string
  name: string
  icon: string
  action: string
  confirmation: boolean
  params?: Record<string, unknown>
}

/**
 * Watch 仪表盘摘要
 */
export interface WatchSummary {
  sentinel: {
    status: string
    eventLoopLag: number
    lastBeat: number
  }
  agents: {
    total: number
    healthy: number
    unhealthy: number
  }
  sessions: {
    active: number
    warning: number
    takeover: number
  }
  quickCommands: QuickCommand[]
}

/**
 * Watch 推送通知类型
 */
export type WatchNotificationType =
  | 'security_alert'
  | 'session_timeout'
  | 'agent_dead'
  | 'health_degraded'
  | 'command_result'

/**
 * Watch 推送通知载荷
 */
export interface WatchNotificationPayload {
  type: WatchNotificationType
  priority: 'high' | 'normal' | 'low'
  title: string
  body: string
  data: Record<string, unknown>
  timestamp: number
}

/**
 * 安全警报载荷
 */
export interface SecurityAlertPayload extends WatchNotificationPayload {
  type: 'security_alert'
  data: {
    sessionId: string
    reason: 'input_blocked' | 'output_blocked' | 'timeout' | 'rate_limit'
    message: string
  }
}

/**
 * 会话超时载荷
 */
export interface SessionTimeoutPayload extends WatchNotificationPayload {
  type: 'session_timeout'
  data: {
    sessionId: string
    agentId: string
    stage: 'warning' | 'prompt' | 'takeover'
    elapsed: number
  }
}

/**
 * Agent 失联载荷
 */
export interface AgentDeadPayload extends WatchNotificationPayload {
  type: 'agent_dead'
  data: {
    agentId: string
    agentName?: string
    lastHeartbeat: number
  }
}

/**
 * Watch 设备注册
 */
export interface WatchDeviceRegistration {
  deviceToken: string
  userId: string
  deviceName?: string
}

/**
 * 会话操作请求
 */
export interface SessionActionRequest {
  action: 'pause' | 'resume' | 'terminate' | 'touch'
}

/**
 * 快捷指令执行结果
 */
export interface CommandResult {
  success: boolean
  message?: string
  data?: Record<string, unknown>
}
