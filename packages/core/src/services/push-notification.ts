/**
 * Push Notification Service - APNs 推送服务
 *
 * 用于向 Apple Watch 发送安全警报、会话超时等通知
 */

import type {
  WatchNotificationPayload,
  SecurityAlertPayload,
  SessionTimeoutPayload,
  AgentDeadPayload,
} from '@colomind/types'

/**
 * 推送配置
 */
export interface PushConfig {
  cert?: string | Buffer // APNs 证书 (p8/pem)
  key?: string | Buffer // APNs 私钥
  teamId?: string // Apple Team ID
  keyId?: string // APNs Key ID
  bundleId?: string // App Bundle ID (com.colomind.nexusmind.watch)
  production?: boolean // 是否使用生产环境
}

/**
 * 推送结果
 */
export interface PushResult {
  success: boolean
  deviceId?: string
  error?: string
}

/**
 * 设备信息
 */
interface DeviceInfo {
  deviceToken: string
  userId: string
  deviceName?: string
  lastActiveAt?: number
}

/**
 * Push Notification Service
 */
export class PushNotificationService {
  private config: PushConfig
  private devices: Map<string, DeviceInfo[]> = new Map() // userId -> devices

  constructor(config: PushConfig) {
    this.config = config
  }

  /**
   * 注册设备
   */
  registerDevice(deviceToken: string, userId: string, deviceName?: string): void {
    const userDevices = this.devices.get(userId) || []
    const existing = userDevices.find(d => d.deviceToken === deviceToken)

    if (existing) {
      existing.lastActiveAt = Date.now()
      existing.deviceName = deviceName
    } else {
      userDevices.push({
        deviceToken,
        userId,
        deviceName,
        lastActiveAt: Date.now(),
      })
    }

    this.devices.set(userId, userDevices)
  }

  /**
   * 取消注册设备
   */
  unregisterDevice(deviceToken: string): void {
    for (const [userId, devices] of this.devices) {
      const filtered = devices.filter(d => d.deviceToken !== deviceToken)
      if (filtered.length === 0) {
        this.devices.delete(userId)
      } else {
        this.devices.set(userId, filtered)
      }
    }
  }

  /**
   * 获取用户的所有设备
   */
  getUserDevices(userId: string): DeviceInfo[] {
    return this.devices.get(userId) || []
  }

  /**
   * 发送通知到单个设备
   *
   * 注意: 实际 APNs 调用需要使用 apn 库或 HTTP/2 API
   * 这里提供接口定义，实际实现需要配置 APNs 证书
   */
  async sendToDevice(deviceToken: string, payload: WatchNotificationPayload): Promise<PushResult> {
    // TODO: 实际 APNs 调用
    // 示例实现 (需要安装 apn 包):
    //
    // const apn = require('apn')
    // const provider = new apn.Provider({
    //   token: {
    //     key: this.config.key,
    //     keyId: this.config.keyId,
    //     teamId: this.config.teamId,
    //   },
    //   production: this.config.production,
    // })
    //
    // const notification = new apn.Notification()
    // notification.topic = this.config.bundleId
    // notification.expiry = Math.floor(Date.now() / 1000) + 3600
    // notification.badge = payload.priority === 'high' ? 1 : 0
    // notification.sound = payload.priority === 'high' ? 'alert.aiff' : undefined
    // notification.alert = { title: payload.title, body: payload.body }
    // notification.payload = payload.data
    //
    // const result = await provider.send(notification, deviceToken)

    console.log('[Push] Sending notification:', {
      deviceToken,
      type: payload.type,
      title: payload.title,
      priority: payload.priority,
    })

    // 模拟成功响应
    return {
      success: true,
      deviceId: deviceToken,
    }
  }

  /**
   * 发送通知到用户的所有设备
   */
  async broadcastToUser(userId: string, payload: WatchNotificationPayload): Promise<PushResult[]> {
    const devices = this.getUserDevices(userId)

    if (devices.length === 0) {
      console.log('[Push] No devices registered for user:', userId)
      return []
    }

    const results: PushResult[] = []

    for (const device of devices) {
      const result = await this.sendToDevice(device.deviceToken, payload)
      results.push(result)
    }

    return results
  }

  /**
   * 发送安全警报
   */
  async sendSecurityAlert(
    userId: string,
    sessionId: string,
    reason: 'input_blocked' | 'output_blocked' | 'timeout' | 'rate_limit',
    message: string
  ): Promise<PushResult[]> {
    const payload: SecurityAlertPayload = {
      type: 'security_alert',
      priority: 'high',
      title: '安全警报',
      body: message,
      data: {
        sessionId,
        reason,
        message,
      },
      timestamp: Date.now(),
    }

    return this.broadcastToUser(userId, payload)
  }

  /**
   * 发送会话超时警告
   */
  async sendSessionTimeout(
    userId: string,
    sessionId: string,
    agentId: string,
    stage: 'warning' | 'prompt' | 'takeover',
    elapsed: number
  ): Promise<PushResult[]> {
    const title = stage === 'takeover' ? '会话已接管' : stage === 'prompt' ? '会话即将超时' : '会话超时警告'
    const body = `会话 ${sessionId.slice(0, 8)} 已运行 ${Math.floor(elapsed / 1000)} 秒`

    const payload: SessionTimeoutPayload = {
      type: 'session_timeout',
      priority: stage === 'takeover' ? 'high' : 'normal',
      title,
      body,
      data: {
        sessionId,
        agentId,
        stage,
        elapsed,
      },
      timestamp: Date.now(),
    }

    return this.broadcastToUser(userId, payload)
  }

  /**
   * 发送 Agent 失联通知
   */
  async sendAgentDead(userId: string, agentId: string, agentName?: string): Promise<PushResult[]> {
    const payload: AgentDeadPayload = {
      type: 'agent_dead',
      priority: 'high',
      title: 'Agent 失联',
      body: agentName ? `${agentName} 已失联，正在接管相关会话` : `Agent ${agentId} 已失联`,
      data: {
        agentId,
        agentName,
        lastHeartbeat: Date.now(),
      },
      timestamp: Date.now(),
    }

    return this.broadcastToUser(userId, payload)
  }

  /**
   * 发送健康状态降级通知
   */
  async sendHealthDegraded(userId: string, eventLoopLag: number): Promise<PushResult[]> {
    const payload: WatchNotificationPayload = {
      type: 'health_degraded',
      priority: 'normal',
      title: '系统健康降级',
      body: `Event Loop 延迟 ${eventLoopLag}ms`,
      data: {
        eventLoopLag,
      },
      timestamp: Date.now(),
    }

    return this.broadcastToUser(userId, payload)
  }

  /**
   * 发送指令执行结果
   */
  async sendCommandResult(
    userId: string,
    commandName: string,
    success: boolean,
    message?: string
  ): Promise<PushResult[]> {
    const payload: WatchNotificationPayload = {
      type: 'command_result',
      priority: 'low',
      title: success ? '指令执行成功' : '指令执行失败',
      body: message || `${commandName} 已执行`,
      data: {
        commandName,
        success,
      },
      timestamp: Date.now(),
    }

    return this.broadcastToUser(userId, payload)
  }
}

/**
 * 创建默认推送服务实例
 */
export function createPushService(config?: PushConfig): PushNotificationService {
  return new PushNotificationService(config || {
    bundleId: 'com.colomind.nexusmind.watch',
    production: false,
  })
}