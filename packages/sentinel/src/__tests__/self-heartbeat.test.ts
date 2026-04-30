/**
 * 母 Agent 自身心跳测试
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { SentinelSelfHeartbeat } from '../heartbeat.js'

describe('SentinelSelfHeartbeat', () => {
  let heartbeat: SentinelSelfHeartbeat

  beforeEach(() => {
    heartbeat = new SentinelSelfHeartbeat({
      interval: 500, // 500ms 自检
      threshold: 2000, // 2s 无更新判定异常
    })
  })

  afterEach(() => {
    heartbeat.stop()
  })

  describe('beat', () => {
    it('should update lastBeat timestamp', () => {
      const before = heartbeat.getLastBeat()
      heartbeat.beat()
      const after = heartbeat.getLastBeat()
      expect(after).toBeGreaterThanOrEqual(before)
    })

    it('should reset status to healthy', async () => {
      heartbeat.start()

      // 等待进入异常状态
      await new Promise((r) => setTimeout(r, 2500))
      expect(heartbeat.getStatus()).toBe('dead')

      // 触发心跳
      heartbeat.beat()
      expect(heartbeat.getStatus()).toBe('healthy')
    })

    it('should track event loop lag', () => {
      heartbeat.beat()
      // 第一次调用 lag 为 0（初始化时已设置）
      expect(heartbeat.getEventLoopLag()).toBeGreaterThanOrEqual(0)
    })
  })

  describe('start/stop', () => {
    it('should start self-check timer', async () => {
      heartbeat.start()

      // 等待一段时间，状态应该保持健康
      await new Promise((r) => setTimeout(r, 1000))
      expect(heartbeat.getStatus()).toBe('healthy')
    })

    it('should stop self-check timer', () => {
      heartbeat.start()
      heartbeat.stop()

      // 停止后，即使等待很久状态也不会变化
      //（因为检查定时器已停止）
    })
  })

  describe('status progression', () => {
    it('should progress from healthy to degraded to dead', async () => {
      heartbeat.start()

      // 初始健康
      expect(heartbeat.getStatus()).toBe('healthy')

      // 等待进入降级（超过 threshold/2 = 1000ms）
      await new Promise((r) => setTimeout(r, 1200))
      expect(heartbeat.getStatus()).toBe('degraded')

      // 等待进入异常（超过 threshold = 2000ms）
      await new Promise((r) => setTimeout(r, 1000))
      expect(heartbeat.getStatus()).toBe('dead')
    })
  })

  describe('externalCheck', () => {
    it('should return alive when healthy', () => {
      heartbeat.beat()
      expect(heartbeat.externalCheck()).toBe('alive')
    })

    it('should return dead when threshold exceeded', async () => {
      heartbeat.start()

      // 等待超过阈值
      await new Promise((r) => setTimeout(r, 2500))
      expect(heartbeat.externalCheck()).toBe('dead')
    })
  })

  describe('onStatusChange', () => {
    it('should call callback when status changes', async () => {
      const statusChanges: string[] = []
      heartbeat.setOnStatusChange((status) => {
        statusChanges.push(status)
      })
      heartbeat.start()

      // 等待状态变化
      await new Promise((r) => setTimeout(r, 2500))
      expect(statusChanges.length).toBeGreaterThan(0)
      expect(statusChanges).toContain('degraded')
      expect(statusChanges).toContain('dead')
    })
  })
})
