/**
 * 健康检查模块
 *
 * 提供服务健康状态检查
 */

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: number
  uptime: number
  version: string
  checks: {
    database?: HealthCheck
    redis?: HealthCheck
    llm?: HealthCheck
    sentinel?: HealthCheck
  }
}

export interface HealthCheck {
  status: 'ok' | 'error'
  latency?: number
  message?: string
}

export interface HealthCheckerConfig {
  /** 检查数据库连接 */
  checkDatabase?: () => Promise<boolean>
  /** 检查 Redis 连接 */
  checkRedis?: () => Promise<boolean>
  /** 检查 LLM API */
  checkLLM?: () => Promise<boolean>
  /** 检查 Sentinel 状态 */
  checkSentinel?: () => Promise<boolean>
  /** 版本号 */
  version?: string
}

let startTime = Date.now()
let config: HealthCheckerConfig = {}

/**
 * 初始化健康检查器
 */
export function initHealthChecker(cfg: HealthCheckerConfig = {}): void {
  config = cfg
  startTime = Date.now()
}

/**
 * 执行健康检查
 */
export async function healthCheck(): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {}
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

  // 检查数据库
  if (config.checkDatabase) {
    const start = Date.now()
    try {
      const ok = await config.checkDatabase()
      checks.database = {
        status: ok ? 'ok' : 'error',
        latency: Date.now() - start,
        message: ok ? 'Connected' : 'Connection failed',
      }
      if (!ok) overallStatus = 'unhealthy'
    } catch (error) {
      checks.database = {
        status: 'error',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
      overallStatus = 'unhealthy'
    }
  }

  // 检查 Redis
  if (config.checkRedis) {
    const start = Date.now()
    try {
      const ok = await config.checkRedis()
      checks.redis = {
        status: ok ? 'ok' : 'error',
        latency: Date.now() - start,
        message: ok ? 'Connected' : 'Connection failed',
      }
      if (!ok && overallStatus === 'healthy') overallStatus = 'degraded'
    } catch (error) {
      checks.redis = {
        status: 'error',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
      if (overallStatus === 'healthy') overallStatus = 'degraded'
    }
  }

  // 检查 LLM
  if (config.checkLLM) {
    const start = Date.now()
    try {
      const ok = await config.checkLLM()
      checks.llm = {
        status: ok ? 'ok' : 'error',
        latency: Date.now() - start,
        message: ok ? 'API available' : 'API unavailable',
      }
      if (!ok && overallStatus === 'healthy') overallStatus = 'degraded'
    } catch (error) {
      checks.llm = {
        status: 'error',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
      if (overallStatus === 'healthy') overallStatus = 'degraded'
    }
  }

  // 检查 Sentinel
  if (config.checkSentinel) {
    const start = Date.now()
    try {
      const ok = await config.checkSentinel()
      checks.sentinel = {
        status: ok ? 'ok' : 'error',
        latency: Date.now() - start,
        message: ok ? 'Guarding' : 'Not responding',
      }
      if (!ok) overallStatus = 'unhealthy'
    } catch (error) {
      checks.sentinel = {
        status: 'error',
        latency: Date.now() - start,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
      overallStatus = 'unhealthy'
    }
  }

  return {
    status: overallStatus,
    timestamp: Date.now(),
    uptime: Date.now() - startTime,
    version: config.version ?? 'unknown',
    checks,
  }
}

/**
 * 简单的存活检查（不检查依赖）
 */
export function livenessCheck(): { status: 'ok'; timestamp: number; uptime: number } {
  return {
    status: 'ok',
    timestamp: Date.now(),
    uptime: Date.now() - startTime,
  }
}

/**
 * 就绪检查（检查关键依赖）
 */
export async function readinessCheck(): Promise<{ ready: boolean; checks: Record<string, boolean> }> {
  const checks: Record<string, boolean> = {}

  if (config.checkDatabase) {
    try {
      checks.database = await config.checkDatabase()
    } catch {
      checks.database = false
    }
  }

  if (config.checkSentinel) {
    try {
      checks.sentinel = await config.checkSentinel()
    } catch {
      checks.sentinel = false
    }
  }

  const ready = Object.values(checks).every(Boolean) || Object.keys(checks).length === 0

  return { ready, checks }
}
