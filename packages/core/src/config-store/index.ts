/**
 * 配置存储模块
 *
 * 消费者版本使用 SQLite 存储配置
 */

import fs from 'fs'
import path from 'path'
import { createHash, randomBytes } from 'crypto'

// 配置目录
const CONFIG_DIR =
  process.env.COLOBOT_CONFIG_DIR || path.join(process.env.HOME || '/tmp', '.colobot')
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json')
const DB_FILE = path.join(CONFIG_DIR, 'data.db')

export interface ColoBotConfig {
  // AI 配置
  ai: {
    provider: 'openai' | 'anthropic' | 'minimax' | 'other'
    apiKey: string
    baseUrl?: string
    model?: string
  }
  // 管理员密码（加密存储）
  adminPasswordHash?: string
  // 语言
  language: 'zh-CN' | 'en'
  // 关心程度
  careLevel: 'passive' | 'greet' | 'care'
  // 是否已完成配置
  onboarded: boolean
  // 创建时间
  createdAt: number
  // 更新时间
  updatedAt: number
}

const DEFAULT_CONFIG: ColoBotConfig = {
  ai: {
    provider: 'openai',
    apiKey: '',
  },
  language: 'zh-CN',
  careLevel: 'greet',
  onboarded: false,
  createdAt: Date.now(),
  updatedAt: Date.now(),
}

/**
 * 确保配置目录存在
 */
function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true })
  }
}

/**
 * 检查是否已配置
 */
export function isConfigured(): boolean {
  if (!fs.existsSync(CONFIG_FILE)) {
    return false
  }
  try {
    const config = loadConfig()
    return config.onboarded && config.ai.apiKey.length > 0
  } catch {
    return false
  }
}

/**
 * 加载配置
 */
export function loadConfig(): ColoBotConfig {
  ensureConfigDir()

  if (!fs.existsSync(CONFIG_FILE)) {
    return { ...DEFAULT_CONFIG }
  }

  try {
    const content = fs.readFileSync(CONFIG_FILE, 'utf-8')
    const config = JSON.parse(content) as ColoBotConfig
    return { ...DEFAULT_CONFIG, ...config }
  } catch (error) {
    console.error('Failed to load config:', error)
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * 保存配置
 */
export function saveConfig(config: Partial<ColoBotConfig>): ColoBotConfig {
  ensureConfigDir()

  const current = loadConfig()
  const updated: ColoBotConfig = {
    ...current,
    ...config,
    updatedAt: Date.now(),
  }

  // 如果设置了明文密码，加密存储
  if (config.adminPasswordHash && !config.adminPasswordHash.startsWith('$')) {
    updated.adminPasswordHash = hashPassword(config.adminPasswordHash)
  }

  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}

/**
 * 完成配置向导
 */
export function completeOnboarding(data: {
  provider: string
  apiKey: string
  language: string
  careLevel: string
  adminPassword?: string
}): ColoBotConfig {
  const config = saveConfig({
    ai: {
      provider: data.provider as ColoBotConfig['ai']['provider'],
      apiKey: data.apiKey,
    },
    language: data.language as ColoBotConfig['language'],
    careLevel: data.careLevel as ColoBotConfig['careLevel'],
    adminPasswordHash: data.adminPassword,
    onboarded: true,
  })

  return config
}

/**
 * 验证管理员密码
 */
export function verifyAdminPassword(password: string): boolean {
  const config = loadConfig()
  if (!config.adminPasswordHash) {
    return false
  }

  const hash = hashPassword(password)
  return hash === config.adminPasswordHash
}

/**
 * 哈希密码
 */
function hashPassword(password: string): string {
  const salt = 'colobot-salt-2024' // 固定盐值，生产环境应使用随机盐
  return createHash('sha256')
    .update(password + salt)
    .digest('hex')
}

/**
 * 获取配置目录路径
 */
export function getConfigDir(): string {
  return CONFIG_DIR
}

/**
 * 获取数据库文件路径
 */
export function getDbPath(): string {
  return DB_FILE
}

/**
 * 重置配置（用于测试或重置）
 */
export function resetConfig(): void {
  if (fs.existsSync(CONFIG_FILE)) {
    fs.unlinkSync(CONFIG_FILE)
  }
}

/**
 * 导出配置（不包含敏感信息）
 */
export function exportConfig(): Omit<ColoBotConfig, 'ai' | 'adminPasswordHash'> & {
  ai: { provider: string; hasKey: boolean }
} {
  const config = loadConfig()
  return {
    language: config.language,
    careLevel: config.careLevel,
    onboarded: config.onboarded,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    ai: {
      provider: config.ai.provider,
      hasKey: config.ai.apiKey.length > 0,
    },
  }
}
