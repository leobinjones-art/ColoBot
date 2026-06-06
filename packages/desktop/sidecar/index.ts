import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, createReadStream } from 'fs'
import { join, dirname } from 'path'
import { tmpdir, homedir } from 'os'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { serve } from '@hono/node-server'
import {
  getDb,
  createTodo, getTodo, updateTodo, deleteTodo, listTodos, completeTodo, getTodayTodos,
  createReminder, getReminder, listReminders, deleteReminder, completeReminder, cancelReminder,
  createEvent, getEvent, updateEvent, deleteEvent, getDayEvents, getWeekEvents, getMonthEvents, checkConflict,
  createNote, getNote, updateNote, deleteNote, listNotes, searchNotes, getAllTags,
  createBookmark, getBookmark, deleteBookmark, listBookmarks, searchBookmarks,
  createHabit, getHabit, listHabits, deleteHabit, checkHabit, getHabitLogs, getStreak, isTodayChecked,
  logMood, getMoodEntries, getMoodStats,
  logFinance, getFinanceEntries, getFinanceStats, getMonthlyStats, deleteFinanceEntry,
  logHealth, logExercise, logSleep, logWeight, logWater, getHealthEntries, getHealthStats,
  createCourse, updateProgress, getCourse, listCourses, deleteCourse,
  addReading, updateReadingProgress, getReading, listReadings, deleteReading,
  createGoal, updateGoalProgress, getGoal, listGoals, deleteGoal,
  addInspiration, getInspiration, listInspirations, searchInspirations, deleteInspiration,
  createContact, getContact, updateContact, listContacts, searchContacts, deleteContact, recordInteraction,
  createProject, getProject, updateProject, listProjects, deleteProject,
  createPasswordEntry, getPasswordEntry, getPassword, listPasswordEntries, updatePasswordEntry, deletePasswordEntry, generatePassword, setEncryptionKey,
  startTimeLog, endTimeLog, getTimeLog, getActiveTimeLogs, getTimeLogs, getTimeStats, deleteTimeLog,
} from '@colomind/assistant'
import { chat, chatStream, chatWithConfig, listSkills, configureSearch, search, registerAllTools, ToolExecutorImpl, toolRegistry, type Agent, Gateway, DEFAULT_GATEWAY_CONFIG, llmPool, registerLLMPoolTools, LLMPoolProvider } from '@colomind/core'
import { getSentinel, CharterGuard, getCharterGuard, HeartbeatSender, LLMTakeoverGenerator, getTakeoverMessageManager } from '@colomind/sentinel'
import { charterManager, getBuiltinCharter, listBuiltinCharterTypes, getBuiltinLibrary, listBuiltinLibraries } from '@colomind/charter'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Apply saved search config on startup
try {
  const savedSettings = JSON.parse(readFileSync(join(homedir(), '.colomind', 'desktop-settings.json'), 'utf-8'))
  if (savedSettings.searchEngine && savedSettings.searchEngine !== 'none') {
    configureSearch({
      engine: savedSettings.searchEngine,
      baseUrl: savedSettings.searxngUrl || 'http://127.0.0.1:8080',
    })
    console.log('[sidecar] Search engine configured: ' + savedSettings.searchEngine)
  }
} catch {}

const SETTINGS_DIR = join(homedir(), '.colomind')
const SETTINGS_FILE = join(SETTINGS_DIR, 'desktop-settings.json')

function loadSettings() {
  try {
    if (existsSync(SETTINGS_FILE)) return JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8'))
  } catch { /* */ }
  return {
    openaiApiKey: process.env.OPENAI_API_KEY ? '***' : '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ? '***' : '',
    defaultModel: 'gpt-4o',
    sentinelLlmProvider: 'same',
    sentinelApiKey: '',
    sentinelModel: '',
    sentinelApiEndpoint: '',
    language: 'zh-CN',
    autoStart: false,
    globalShortcut: 'Cmd+Shift+N',
  }
}

function saveSettingsToFile(settings: any) {
  try {
    mkdirSync(SETTINGS_DIR, { recursive: true })
    writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2))
  } catch { /* */ }
}

const app = new Hono()
const UID = 'default'
const PORT = parseInt(process.env.SIDECAR_PORT || '3456')

const assistantDb = getDb()
setEncryptionKey(process.env.COLOMIND_ENCRYPTION_KEY || 'default-desktop-key')

// ─── Gateway 初始化 ────────────────────────────────────────
const gatewayConfig = { ...DEFAULT_GATEWAY_CONFIG, port: PORT, apiKeys: process.env.COLOMIND_API_KEYS?.split(',') || [] }
const gateway = new Gateway(gatewayConfig, assistantDb, getSentinel(), getCharterGuard())
console.log('[sidecar] Gateway initialized with device auth + rate limit + Sentinel + Charter')

// ─── SQLite Agent Registry ──────────────────────────────
// Desktop uses SQLite, not PostgreSQL. We need a local agent store.

const AGENTS_TABLE = 'local_agents'

function initAgentTable() {
  const db = getDb()
  db.exec(`CREATE TABLE IF NOT EXISTS ${AGENTS_TABLE} (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    soul_content TEXT DEFAULT '{}',
    memory_content TEXT DEFAULT '',
    workspace_path TEXT,
    primary_model_id TEXT,
    fallback_model_id TEXT,
    temperature REAL DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 4096,
    context_window_size INTEGER DEFAULT 128000,
    max_tool_rounds INTEGER DEFAULT 3,
    system_prompt_override TEXT,
    status TEXT DEFAULT 'idle',
    created_at TEXT,
    updated_at TEXT
  )`)
  // Migration: add new columns if upgrading from old schema
  const cols = new Set((db.pragma(`table_info(${AGENTS_TABLE})`) as any[]).map((c: any) => c.name))
  if (!cols.has('soul_content')) {
    db.exec(`ALTER TABLE ${AGENTS_TABLE} ADD COLUMN soul_content TEXT DEFAULT '{}'`)
    db.exec(`UPDATE ${AGENTS_TABLE} SET soul_content = soul_json WHERE soul_content = '{}'`)
  }
  if (!cols.has('memory_content')) db.exec(`ALTER TABLE ${AGENTS_TABLE} ADD COLUMN memory_content TEXT DEFAULT ''`)
  if (!cols.has('workspace_path')) db.exec(`ALTER TABLE ${AGENTS_TABLE} ADD COLUMN workspace_path TEXT`)
  if (!cols.has('primary_model_id')) {
    db.exec(`ALTER TABLE ${AGENTS_TABLE} ADD COLUMN primary_model_id TEXT`)
    db.exec(`UPDATE ${AGENTS_TABLE} SET primary_model_id = model WHERE primary_model_id IS NULL`)
  }
  if (!cols.has('fallback_model_id')) db.exec(`ALTER TABLE ${AGENTS_TABLE} ADD COLUMN fallback_model_id TEXT`)
  if (!cols.has('context_window_size')) db.exec(`ALTER TABLE ${AGENTS_TABLE} ADD COLUMN context_window_size INTEGER DEFAULT 128000`)
  if (!cols.has('system_prompt_override')) {
    db.exec(`ALTER TABLE ${AGENTS_TABLE} ADD COLUMN system_prompt_override TEXT`)
    db.exec(`UPDATE ${AGENTS_TABLE} SET system_prompt_override = system_prompt WHERE system_prompt_override IS NULL`)
  }
}

function rowToAgent(row: any): Agent {
  return {
    id: row.id,
    name: row.name,
    soul_content: row.soul_content || '{}',
    memory_content: row.memory_content || '',
    workspace_path: row.workspace_path || undefined,
    primary_model_id: row.primary_model_id || undefined,
    fallback_model_id: row.fallback_model_id || undefined,
    temperature: row.temperature ?? 0.7,
    max_tokens: row.max_tokens ?? 4096,
    context_window_size: row.context_window_size ?? 128000,
    max_tool_rounds: row.max_tool_rounds ?? 3,
    system_prompt_override: row.system_prompt_override || undefined,
    status: row.status || 'idle',
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
  }
}

function listAgents(): Agent[] {
  const db = getDb()
  return (db.prepare(`SELECT * FROM ${AGENTS_TABLE} ORDER BY created_at DESC`).all() as any[]).map(rowToAgent)
}

function getAgent(id: string): Agent | undefined {
  const db = getDb()
  const row = db.prepare(`SELECT * FROM ${AGENTS_TABLE} WHERE id = ?`).get(id) as any
  return row ? rowToAgent(row) : undefined
}

function createAgent(input: { name: string; soul_content?: string; primary_model_id?: string; temperature?: number }): Agent {
  const db = getDb()
  const id = `agent-${Date.now()}`
  const now = new Date().toISOString()
  const workspacePath = join(WORKSPACE_DIR, id)
  db.prepare(`INSERT INTO ${AGENTS_TABLE} (id, name, soul_content, workspace_path, primary_model_id, temperature, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'idle', ?, ?)`).run(
    id, input.name, input.soul_content || '{}', workspacePath, input.primary_model_id || null, input.temperature ?? 0.7, now, now
  )
  return getAgent(id)!
}

function updateAgent(id: string, updates: Partial<Pick<Agent, 'name' | 'soul_content' | 'primary_model_id' | 'temperature' | 'max_tokens' | 'system_prompt_override' | 'status'>>): Agent | undefined {
  const db = getDb()
  const fields: string[] = []
  const values: any[] = []
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) { fields.push(`${k} = ?`); values.push(v) }
  }
  if (!fields.length) return getAgent(id)
  fields.push('updated_at = ?'); values.push(new Date().toISOString())
  values.push(id)
  db.prepare(`UPDATE ${AGENTS_TABLE} SET ${fields.join(', ')} WHERE id = ?`).run(...values)
  return getAgent(id)
}

function deleteAgent(id: string): boolean {
  const db = getDb()
  const r = db.prepare(`DELETE FROM ${AGENTS_TABLE} WHERE id = ?`).run(id)
  return r.changes > 0
}

// Initialize agents table and create default agent
initAgentTable()
const DEFAULT_AGENT_ID = 'default-desktop-agent'
const WORKSPACE_DIR = join(homedir(), '.colomind', 'workspaces')

function getWorkspaceDir(agentId: string) {
  return join(WORKSPACE_DIR, agentId)
}

function readWorkspaceFile(agentId: string, filename: string): string {
  const filePath = join(getWorkspaceDir(agentId), filename)
  try { return readFileSync(filePath, 'utf-8') } catch { return '' }
}

function writeWorkspaceFile(agentId: string, filename: string, content: string) {
  const dir = getWorkspaceDir(agentId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, filename), content)
}

function readWorkspaceJson(agentId: string, filename: string): any {
  const filePath = join(getWorkspaceDir(agentId), filename)
  try { return JSON.parse(readFileSync(filePath, 'utf-8')) } catch { return null }
}

function writeWorkspaceJson(agentId: string, filename: string, data: any) {
  const dir = getWorkspaceDir(agentId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, filename), JSON.stringify(data, null, 2))
}

function bootstrapWorkspace(agentId: string) {
  const dir = getWorkspaceDir(agentId)
  mkdirSync(dir, { recursive: true })
  const agent = getAgent(agentId)
  let soul: any = {}
  try { soul = JSON.parse(agent?.soul_content || '{}') } catch {}
  const defaults: Record<string, any> = {
    'identity.json': { name: agent?.name || 'ColoMind', role: '智能助手', description: '本地优先的全能 AI 助手' },
    'soul.json': { personality: '直接、高效、有想法', rules: ['私密信息绝不外泄', '删除文件前必须确认', '不确定时主动询问用户'], boundaries: ['绝不泄露密钥和凭证', '日志和审计中隐去密钥', '不执行破坏性操作'], tone: '专业简洁' },
    'user.json': { name: '', role: '', preferences: '', notes: '' },
    'tools.json': { skills: ['web_search', 'read_file', 'write_file', 'list_dir', 'python', 'exec_code', 'shell', 'http', 'calculate', 'csv_parse', 'json_parse', 'get_location', 'list_agents', 'create_skill', 'spawn_subagent', 'delegate_task'], guidelines: ['优先使用工具获取实时信息', '大文件用 read_file_chunks 逐块读取', '代码任务优先用 python 或 exec_code', '搜索前先确认用户意图'] },
  }
  for (const [filename, data] of Object.entries(defaults)) {
    const filePath = join(dir, filename)
    if (!existsSync(filePath)) writeFileSync(filePath, JSON.stringify(data, null, 2))
  }
  // Migrate old .md files if they exist but .json files don't
  const mdFiles = ['SOUL.md', 'IDENTITY.md', 'USER.md', 'TOOLS.md']
  const jsonFiles = ['soul.json', 'identity.json', 'user.json', 'tools.json']
  const hasOldMd = mdFiles.some(f => existsSync(join(dir, f)))
  const hasNewJson = jsonFiles.some(f => existsSync(join(dir, f)))
  if (hasOldMd && !hasNewJson) {
    const soulMd = readWorkspaceFile(agentId, 'SOUL.md')
    const identityMd = readWorkspaceFile(agentId, 'IDENTITY.md')
    const userMd = readWorkspaceFile(agentId, 'USER.md')
    const toolsMd = readWorkspaceFile(agentId, 'TOOLS.md')
    // Parse IDENTITY.md
    const identity: Record<string, string> = {}
    for (const line of identityMd.split('\n')) {
      const m = line.match(/^- (\w+):\s*(.*)/)
      if (m) identity[m[1].toLowerCase()] = m[2].trim()
    }
    writeWorkspaceJson(agentId, 'identity.json', { name: identity.name || agent?.name || 'ColoMind', role: identity.role || 'AI 助手', description: identity.personality || '' })
    // Parse SOUL.md
    const personalityLines = soulMd.split('\n').filter(l => l.startsWith('- ') && !/^##/.test(l))
    const personality = personalityLines.map(l => l.replace(/^- /, '')).join(' ') || '直接、高效'
    const rules: string[] = []
    let inRules = false
    for (const line of soulMd.split('\n')) {
      if (/^## (Rules|Boundaries|规则|边界)/.test(line)) { inRules = true; continue }
      if (/^## /.test(line) && inRules) { inRules = false; continue }
      if (inRules && line.startsWith('- ')) rules.push(line.replace(/^- /, ''))
    }
    writeWorkspaceJson(agentId, 'soul.json', { personality, rules, boundaries: [], tone: '专业简洁' })
    // Parse USER.md
    const user: Record<string, string> = {}
    for (const line of userMd.split('\n')) {
      const m = line.match(/^- (.+?):\s*(.*)/)
      if (m) user[m[1].trim().toLowerCase()] = m[2].trim()
    }
    writeWorkspaceJson(agentId, 'user.json', { name: user.name || '', role: user.role || user['称呼'] || '', preferences: '', notes: user.notes || '' })
    // Parse TOOLS.md
    const skills: string[] = []
    for (const line of toolsMd.split('\n')) {
      if (line.startsWith('- ') && !line.startsWith('- #')) skills.push(line.replace(/^- /, '').split(':')[0].trim())
    }
    writeWorkspaceJson(agentId, 'tools.json', { skills, guidelines: [] })
    // Delete old .md files
    for (const f of mdFiles) {
      const p = join(dir, f)
      if (existsSync(p)) unlinkSync(p)
    }
    addLog('info', 'agent', `Migrated workspace from .md to .json for ${agentId}`, { agentId })
  }
}

// Sync: workspace .json files → Agent.soul_content in DB
function syncSoulFromWorkspace(agentId: string) {
  const identity = readWorkspaceJson(agentId, 'identity.json') || {}
  const soul = readWorkspaceJson(agentId, 'soul.json') || {}
  const tools = readWorkspaceJson(agentId, 'tools.json') || {}
  const soulContent = {
    ...(identity.role && { role: identity.role }),
    ...(soul.personality && { personality: soul.personality }),
    ...(soul.rules?.length && { rules: soul.rules }),
    ...(tools.skills?.length && { skills: tools.skills }),
  }
  updateAgent(agentId, { soul_content: JSON.stringify(soulContent) })
}

// System capabilities appended to every agent's system prompt
const SYSTEM_CAPABILITIES = `
## 系统能力

你是 ColoMind 智能体平台的一部分，运行在以下系统架构上：

- **Sentinel 安全守护**：三层防御系统，实时扫描所有输入和输出。词汇层过滤危险关键词，意图层用 LLM 分析恶意意图，法律层进行合规审查。所有对话都经过 Sentinel 保护。
- **Charter 宪章守护**：行为准则系统，确保你的行为符合预设规则和边界。
- **LLM 模型库**：你运行在可切换的 LLM 模型上，用户可以通过模型选择器切换不同模型（如快速模型、强力模型等）。
- **子智能体**：你可以通过 delegate_task 工具委派子任务给专门的子智能体执行。
- **工具系统**：你拥有搜索、文件读写、代码执行、任务管理等多种工具。
- **记忆系统**：支持短期工作记忆、长期知识记忆和情景记忆。

当用户询问关于 Sentinel、Charter 或系统能力时，请如实介绍这些功能。
`

// Build system prompt from workspace .json files
function buildWorkspaceSystemPrompt(agentId: string): string {
  const identity = readWorkspaceJson(agentId, 'identity.json')
  const soul = readWorkspaceJson(agentId, 'soul.json')
  const user = readWorkspaceJson(agentId, 'user.json')
  const tools = readWorkspaceJson(agentId, 'tools.json')
  if (identity || soul) {
    const parts: string[] = []
    // Identity
    if (identity) {
      if (identity.name) parts.push(`你的名字是 ${identity.name}。`)
      if (identity.role) parts.push(`你的角色是 ${identity.role}。`)
      if (identity.description) parts.push(identity.description)
    }
    // Soul
    if (soul) {
      if (soul.personality) parts.push(`\n## 性格\n${soul.personality}`)
      if (soul.tone) parts.push(`\n## 语气\n${soul.tone}`)
      if (soul.rules?.length) parts.push(`\n## 规则\n${soul.rules.map((r: string) => `- ${r}`).join('\n')}`)
      if (soul.boundaries?.length) parts.push(`\n## 边界\n${soul.boundaries.map((b: string) => `- ${b}`).join('\n')}`)
    }
    // User
    if (user) {
      const userParts: string[] = []
      if (user.name) userParts.push(`名字: ${user.name}`)
      if (user.role) userParts.push(`角色: ${user.role}`)
      if (user.preferences) userParts.push(`偏好: ${user.preferences}`)
      if (user.notes) userParts.push(`备注: ${user.notes}`)
      if (userParts.length) parts.push(`\n## 关于用户\n${userParts.join('\n')}`)
    }
    // Tools
    if (tools) {
      if (tools.skills?.length) parts.push(`\n## 技能\n${tools.skills.map((s: string) => `- ${s}`).join('\n')}`)
      if (tools.guidelines?.length) parts.push(`\n## 工具指南\n${tools.guidelines.map((g: string) => `- ${g}`).join('\n')}`)
    }
    const prompt = parts.join('\n\n')
    if (prompt) return prompt + '\n\n' + SYSTEM_CAPABILITIES
  }
  // Fallback: build from soul_content JSON in DB
  const agent = getAgent(agentId)
  if (!agent) return SYSTEM_CAPABILITIES
  if (agent.system_prompt_override) return agent.system_prompt_override + '\n\n' + SYSTEM_CAPABILITIES
  try {
    const s = JSON.parse(agent.soul_content || '{}')
    const parts: string[] = []
    if (s.role) parts.push(`你是 ${s.role}。`)
    if (s.personality) parts.push(`\n## 性格\n${s.personality}`)
    if (s.rules?.length) parts.push(`\n## 规则\n${s.rules.map((r: string) => `- ${r}`).join('\n')}`)
    if (s.skills?.length) parts.push(`\n## 技能\n${s.skills.map((sk: string) => `- ${sk}`).join('\n')}`)
    const result = parts.join('\n\n')
    return result ? result + '\n\n' + SYSTEM_CAPABILITIES : SYSTEM_CAPABILITIES
  } catch { return SYSTEM_CAPABILITIES }
}

if (!getAgent(DEFAULT_AGENT_ID)) {
  const defaultAgent = createAgent({
    name: 'ColoMind',
    soul_content: JSON.stringify({ role: '智能助手', personality: '直接、高效、有想法', rules: ['私密信息绝不外泄', '删除文件前必须确认', '不确定时主动询问'], skills: ['对话', '搜索', '文件读写', '代码执行', '任务管理'] }),
    temperature: 0.7,
  })
  const db = getDb()
  db.prepare(`UPDATE ${AGENTS_TABLE} SET id = ? WHERE id = ?`).run(DEFAULT_AGENT_ID, defaultAgent.id)
  console.log(`[sidecar] Default agent created: ${DEFAULT_AGENT_ID}`)
} else {
  console.log(`[sidecar] Default agent already exists: ${DEFAULT_AGENT_ID}`)
}
bootstrapWorkspace(DEFAULT_AGENT_ID)
syncSoulFromWorkspace(DEFAULT_AGENT_ID)

registerAllTools()
registerLLMPoolTools()

// Override agent tools to use local SQLite instead of core's PostgreSQL agentRegistry
for (const name of ['list_agents', 'get_agent', 'update_agent', 'delete_agent']) {
  toolRegistry.unregister(name)
}
toolRegistry.register({
  name: 'list_agents', description: '列出所有智能体',
  parameters: { type: 'object', properties: {}, required: [] },
  execute: async () => JSON.stringify(listAgents()),
})
toolRegistry.register({
  name: 'get_agent', description: '获取智能体详情',
  parameters: { type: 'object', properties: { id: { type: 'string', description: '智能体ID' } }, required: ['id'] },
  execute: async (args: any) => JSON.stringify(getAgent(args.id)),
})
toolRegistry.register({
  name: 'update_agent', description: '更新智能体配置',
  parameters: { type: 'object', properties: { id: { type: 'string' }, name: { type: 'string' }, soul_content: { type: 'string' }, temperature: { type: 'number' } }, required: ['id'] },
  execute: async (args: any) => { const { id, ...updates } = args; return JSON.stringify(updateAgent(id, updates)) },
})
toolRegistry.register({
  name: 'delete_agent', description: '删除智能体',
  parameters: { type: 'object', properties: { id: { type: 'string', description: '智能体ID' } }, required: ['id'] },
  execute: async (args: any) => JSON.stringify({ ok: deleteAgent(args.id) }),
})
toolRegistry.register({
  name: 'create_agent', description: '创建智能体',
  parameters: { type: 'object', properties: { name: { type: 'string' }, soul_content: { type: 'string' }, temperature: { type: 'number' } }, required: ['name'] },
  execute: async (args: any) => JSON.stringify(createAgent(args)),
})

const toolExec = new ToolExecutorImpl(toolRegistry)

// ─── LLM helpers ────────────────────────────────────
function getLLMConfig(providerId?: string) {
  // If pool has a provider, use it (supports dynamic switching)
  const poolConfig = llmPool.toConfig(providerId)
  if (poolConfig) return poolConfig

  // Fallback to settings-based config
  const saved = loadSettings()
  const provider = saved.llmProvider || process.env.LLM_PROVIDER || 'anthropic'
  if (provider === 'openai') {
    let ep = saved.openaiApiEndpoint || process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions'
    if (!ep.includes('/v1/')) ep += '/v1/chat/completions'
    return {
      provider: 'openai' as const,
      apiKey: saved.openaiApiKey || process.env.OPENAI_API_KEY || '',
      endpoint: ep,
      // UI 的 defaultModel 字段映射到 openaiDefaultModel
      model: saved.openaiDefaultModel || saved.defaultModel || process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
    }
  }
  let ep = saved.anthropicApiEndpoint || process.env.ANTHROPIC_API_ENDPOINT || 'https://api.anthropic.com/v1/messages'
  if (!ep.includes('/v1/messages')) ep = ep.replace(/\/$/, '') + '/v1/messages'
  return {
    provider: 'anthropic' as const,
    apiKey: saved.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
    endpoint: ep,
    // UI 的 defaultModel 字段映射到 anthropicDefaultModel
    model: saved.anthropicDefaultModel || saved.defaultModel || process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-sonnet-4-6',
  }
}

// 获取 Sentinel 安全推理模型的 LLM 配置
// 如果未单独配置，fallback 到主聊天模型
function getSentinelLLMConfig(): { provider: 'openai' | 'anthropic'; apiKey: string; endpoint: string; model: string } {
  const saved = loadSettings()

  // 如果 sentinelLlmProvider 为 'same' 或未设置，复用主模型配置
  const sentinelProvider = saved.sentinelLlmProvider
  if (!sentinelProvider || sentinelProvider === 'same') {
    return getLLMConfig()
  }

  // 使用独立的安全推理模型配置
  if (sentinelProvider === 'openai') {
    const mainConfig = getLLMConfig()
    let ep = saved.sentinelApiEndpoint || saved.openaiApiEndpoint || process.env.OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions'
    if (!ep.includes('/v1/')) ep += '/v1/chat/completions'
    return {
      provider: 'openai' as const,
      apiKey: saved.sentinelApiKey || saved.openaiApiKey || process.env.OPENAI_API_KEY || '',
      endpoint: ep,
      model: saved.sentinelModel || 'gpt-4o-mini',
    }
  }

  // anthropic
  let ep = saved.sentinelApiEndpoint || saved.anthropicApiEndpoint || process.env.ANTHROPIC_API_ENDPOINT || 'https://api.anthropic.com/v1/messages'
  if (!ep.includes('/v1/messages')) ep = ep.replace(/\/$/, '') + '/v1/messages'
  return {
    provider: 'anthropic' as const,
    apiKey: saved.sentinelApiKey || saved.anthropicApiKey || process.env.ANTHROPIC_API_KEY || '',
    endpoint: ep,
    model: saved.sentinelModel || 'claude-haiku-4-5-20251001',
  }
}

// Initialize LLMPool with default provider from settings
function initLLMPool() {
  const config = getLLMConfig()
  llmPool.register({
    id: 'default',
    provider: config.provider,
    apiKey: config.apiKey,
    endpoint: config.endpoint,
    model: config.model,
    tags: ['default', 'balanced'],
  })

  // Pre-register common models using same API keys
  if (config.provider === 'anthropic' && config.apiKey) {
    const base = config.endpoint.replace(/\/v1\/messages.*$/, '')
    llmPool.register({ id: 'fast', provider: 'anthropic', apiKey: config.apiKey, endpoint: `${base}/v1/messages`, model: 'claude-haiku-4-5-20251001', tags: ['fast', 'cheap'] })
    llmPool.register({ id: 'powerful', provider: 'anthropic', apiKey: config.apiKey, endpoint: `${base}/v1/messages`, model: 'claude-opus-4-7', tags: ['powerful', 'expensive'] })
  }
  if (config.provider === 'openai' && config.apiKey) {
    const base = config.endpoint.replace(/\/v1\/chat\/completions.*$/, '')
    llmPool.register({ id: 'fast', provider: 'openai', apiKey: config.apiKey, endpoint: `${base}/v1/chat/completions`, model: 'gpt-4o-mini', tags: ['fast', 'cheap'] })
    llmPool.register({ id: 'powerful', provider: 'openai', apiKey: config.apiKey, endpoint: `${base}/v1/chat/completions`, model: 'o3', tags: ['powerful', 'expensive'] })
  }

  // If user has both API keys, cross-register
  const saved = loadSettings()
  if (config.provider === 'anthropic' && (saved.openaiApiKey || process.env.OPENAI_API_KEY)) {
    const oKey = saved.openaiApiKey || process.env.OPENAI_API_KEY || ''
    const oEp = saved.openaiApiEndpoint || 'https://api.openai.com/v1/chat/completions'
    llmPool.register({ id: 'openai-fast', provider: 'openai', apiKey: oKey, endpoint: oEp, model: 'gpt-4o-mini', tags: ['fast', 'cheap'] })
    llmPool.register({ id: 'openai-default', provider: 'openai', apiKey: oKey, endpoint: oEp, model: 'gpt-4o', tags: ['balanced'] })
  }
  if (config.provider === 'openai' && (saved.anthropicApiKey || process.env.ANTHROPIC_API_KEY)) {
    const aKey = saved.anthropicApiKey || process.env.ANTHROPIC_API_KEY || ''
    const aEp = saved.anthropicApiEndpoint || 'https://api.anthropic.com/v1/messages'
    llmPool.register({ id: 'anthropic-fast', provider: 'anthropic', apiKey: aKey, endpoint: aEp, model: 'claude-haiku-4-5-20251001', tags: ['fast', 'cheap'] })
    llmPool.register({ id: 'anthropic-default', provider: 'anthropic', apiKey: aKey, endpoint: aEp, model: 'claude-sonnet-4-6', tags: ['balanced'] })
  }

  // Register sentinel provider if configured independently
  const sentinelConfig = getSentinelLLMConfig()
  const sentinelSettings = loadSettings()
  if (sentinelSettings.sentinelLlmProvider && sentinelSettings.sentinelLlmProvider !== 'same') {
    llmPool.register({
      id: 'sentinel',
      provider: sentinelConfig.provider,
      apiKey: sentinelConfig.apiKey,
      endpoint: sentinelConfig.endpoint,
      model: sentinelConfig.model,
      tags: ['sentinel', 'security'],
    })
  }

  console.log(`[sidecar] LLMPool initialized: ${llmPool.list().map(p => `${p.id}=${p.provider}/${p.model}`).join(', ')}`)
}
initLLMPool()

// Streaming Anthropic API call with tools support
// Custom streaming implementation instead of core's `agentChatStream`.
// Reason: core's agentChatStream doesn't support extended thinking, custom tool-loop
// with round tracking, or inline Sentinel scanning. Once these features are added
// to core, this should be replaced with `agentChatStream`.
async function* anthropicStreamWithTools(messages: any[], toolDefs: any[], systemPrompt?: string, enableThinking = true) {
  const config = getLLMConfig()
  const body: any = {
    model: config.model,
    max_tokens: 8192,
    stream: true,
    messages: messages.filter((m: any) => m.role !== 'system'),
  }
  // Use agent's system prompt if provided, otherwise extract from messages
  const sysMsg = systemPrompt || messages.find((m: any) => m.role === 'system')?.content
  if (sysMsg) body.system = sysMsg
  if (toolDefs.length > 0) body.tools = toolDefs
  // Extended thinking: only enable when no tools needed (Anthropic API limitation)
  // When tools are present, thinking mode can suppress tool_use behavior
  const hasToolRequest = messages.some((m: any) =>
    typeof m.content === 'string' && (
      m.content.includes('调用') || m.content.includes('工具') || m.content.includes('查询') ||
      m.content.includes('查一下') || m.content.includes('搜索') || m.content.includes('检查') ||
      m.content.includes('system_info') || m.content.includes('sentinel') || m.content.includes('health')
    )
  )
  if (enableThinking && config.provider === 'anthropic' && !hasToolRequest) {
    body.thinking = { type: 'enabled', budget_tokens: 4096 }
  }

  const r = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const err = await r.text()
    throw new Error(`API error ${r.status}: ${err}`)
  }

  const reader = r.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const contentBlocks: any[] = []
  let currentBlock: any = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    // Keep last (potentially incomplete) line in buffer
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue
      try {
        const event = JSON.parse(data)
        if (event.type === 'content_block_start') {
          currentBlock = { index: event.index, ...event.content_block }
          if (currentBlock.type === 'text') currentBlock.text = ''
          if (currentBlock.type === 'thinking') currentBlock.thinking = ''
          if (currentBlock.type === 'tool_use') currentBlock.input = {}
        } else if (event.type === 'content_block_delta') {
          if (currentBlock?.type === 'thinking' && event.delta?.thinking) {
            currentBlock.thinking += event.delta.thinking
            yield { type: 'thinking', thinking: event.delta.thinking }
          } else if (currentBlock?.type === 'text' && event.delta?.text) {
            currentBlock.text += event.delta.text
            yield { type: 'text', text: event.delta.text }
          } else if (currentBlock?.type === 'tool_use' && event.delta?.partial_json) {
            if (!currentBlock._partialInput) currentBlock._partialInput = ''
            currentBlock._partialInput += event.delta.partial_json
          }
        } else if (event.type === 'content_block_stop') {
          if (currentBlock?.type === 'tool_use' && currentBlock._partialInput) {
            try { currentBlock.input = JSON.parse(currentBlock._partialInput) } catch {}
          }
          contentBlocks.push({ ...currentBlock })
          currentBlock = null
        } else if (event.type === 'message_stop') {
          // Done
        }
      } catch {}
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith('data: ')) {
    const data = buffer.slice(6).trim()
    if (data !== '[DONE]') {
      try { JSON.parse(data) } catch {}
    }
  }

  yield { type: 'done', contentBlocks }
}

app.use('*', cors())

// ─── Gateway 中间件链（所有 /api/* 请求经过审计+认证+限流） ──

app.use('/api/*', async (c, next) => {
  const apiKey = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || c.req.header('X-API-Key') || ''
  const gwReq = {
    path: c.req.path,
    method: c.req.method,
    headers: Object.fromEntries(c.req.raw.headers.entries()),
    body: null,
    query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
    context: {
      channelId: 'http',
      sessionId: c.req.header('X-Session-Id'),
      apiKey: apiKey || undefined,
      clientIp: c.req.header('X-Forwarded-For') || c.req.header('X-Real-IP'),
    },
  }
  // 执行前 4 个中间件：audit → device-auth → api-auth → rate-limit
  const securityChain = gateway.getMiddlewares().slice(0, 4)
  let currentIdx = 0

  const passThrough = async () => {
    if (currentIdx >= securityChain.length) {
      return { status: 200, body: null }
    }
    const mw = securityChain[currentIdx]
    currentIdx++
    return mw(gwReq, passThrough)
  }

  const gwRes = await passThrough()
  if (gwRes.status >= 400 && gwRes.status !== 404) {
    return c.json(gwRes.body, gwRes.status as 400)
  }
  if (gwReq.context.device) {
    c.header('X-Device-Token', gwReq.context.device.deviceToken || '')
  }
  await next()
})

// ─── Gateway 端点（设备绑定 + 健康检查） ──────────────────

app.get('/healthz', (c) => c.json({ status: 'ok', timestamp: Date.now(), uptime: process.uptime() }))
app.get('/livez', (c) => c.json({ status: 'ok', timestamp: Date.now() }))
app.get('/readyz', (c) => c.json({ status: 'ok', sentinel: !!getSentinel(), charter: !!getCharterGuard() }))

app.post('/api/device/bind', async (c) => {
  const body = await c.req.json().catch(() => ({}))
  const deviceId = body.deviceId || c.req.header('X-Device-Id')
  if (!deviceId) return c.json({ error: 'Missing deviceId' }, 400)
  const platform = body.platform || c.req.header('X-Platform') || 'unknown'
  const userAgent = c.req.header('User-Agent') || ''
  const apiKey = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || c.req.header('X-API-Key') || 'default'
  const result = gateway.bindDevice(apiKey, deviceId, platform, userAgent)
  if ('error' in result) {
    const status = result.code === 'token_required' ? 401 : 403
    return c.json(result, status)
  }
  return c.json(result, 201)
})

app.delete('/api/device/unbind', async (c) => {
  const deviceId = c.req.header('X-Device-Id')
  if (!deviceId) return c.json({ error: 'Missing X-Device-Id' }, 400)
  const apiKey = c.req.header('Authorization')?.replace(/^Bearer\s+/i, '') || c.req.header('X-API-Key') || 'default'
  const removed = gateway.unbindDevice(apiKey, deviceId)
  if (!removed) return c.json({ error: 'Device not found' }, 404)
  return c.json({ unbound: deviceId })
})

// ─── Web UI ───────────────────────────────────────────

app.get('/', (c) => {
  const html = readFileSync(join(__dirname, 'ui.html'), 'utf-8')
  return c.html(html)
})

app.get('/favicon.ico', (c) => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#6366f1"/><text x="16" y="23" font-size="20" font-family="sans-serif" font-weight="bold" fill="white" text-anchor="middle">C</text></svg>'
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } })
})

// ─── Health ────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ ok: true, port: PORT }))
app.get('/api/tools', (c) => c.json((toolRegistry.getOpenAITools?.() || []).map(t => ({ name: t.function?.name, desc: (t.function?.description || '').slice(0, 80) }))))

app.get('/api/llm/providers', (c) => {
  const providers = llmPool.list().map(p => ({
    id: p.id,
    provider: p.provider,
    model: p.model,
    isDefault: p.id === llmPool.getDefaultId(),
    tags: p.tags || [],
  }))
  return c.json(providers)
})

app.post('/api/llm/providers', async (c) => {
  const body = await c.req.json()
  const { id, provider, apiKey, endpoint, model, maxTokens, temperature, tags } = body
  if (!id || !provider || !apiKey || !endpoint || !model) return c.json({ error: 'Missing required fields' }, 400)
  llmPool.register({ id, provider, apiKey, endpoint, model, maxTokens, temperature, tags })
  return c.json({ ok: true, id })
})

app.put('/api/llm/default', async (c) => {
  const body = await c.req.json()
  if (!body.id) return c.json({ error: 'Missing id' }, 400)
  try {
    llmPool.setDefault(body.id)
    return c.json({ ok: true, defaultProvider: body.id })
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

app.delete('/api/llm/providers/:id', (c) => {
  const id = c.req.param('id')
  try {
    const deleted = llmPool.unregister(id)
    return c.json({ ok: deleted, id })
  } catch (e: any) {
    return c.json({ error: e.message }, 400)
  }
})

// ─── File Upload ────────────────────────────────────────

const UPLOAD_DIR = join(homedir(), '.colomind', 'uploads')
mkdirSync(UPLOAD_DIR, { recursive: true })

app.post('/api/upload', async (c) => {
  const body = await c.req.parseBody()
  const files = body['files']
  if (!files) return c.json({ error: 'No files' }, 400)
  const fileArr = Array.isArray(files) ? files : [files]
  const results = []
  for (const f of fileArr) {
    const safeName = f.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const dest = join(UPLOAD_DIR, safeName)
    // @ts-ignore - Hono FileProps has arrayBuffer
    const buf = await f.arrayBuffer()
    writeFileSync(dest, Buffer.from(buf))
    results.push({ name: f.name, path: dest, size: f.size })
  }
  return c.json({ files: results })
})

app.get('/api/sessions/:id/messages', (c) => {
  const db = getDb()
  const rows = db.prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(c.req.param('id'))
  return c.json(rows || [])
})

// ─── Chat ──────────────────────────────────────────────

app.post('/api/chat/stream', async (c) => {
  const body = await c.req.json()
  const sid = body.sessionId || 'default'
  const agentId = body.agentId || DEFAULT_AGENT_ID
  const now = new Date().toISOString()
  const startTime = Date.now()
  const inputText = body.messages?.filter((m: any) => m.role === 'user').map((m: any) => typeof m.content === 'string' ? m.content : '').join(' ') || ''
  addLog('info', 'chat', `收到对话请求`, { sessionId: sid, agentId, input: inputText.slice(0, 200), detail: `messages: ${body.messages?.length || 0}` })
  // Save user messages
  for (const m of body.messages || []) {
    if (m.role === 'user') {
      db.prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(sid, 'user', m.content, now)
    }
  }

  const agent = getAgent(agentId)
  const systemPrompt = buildWorkspaceSystemPrompt(agentId)
  const maxRounds = agent?.max_tool_rounds ?? 5

  return streamSSE(c, async (stream) => {
    try {
      // Check if LLM is configured
      const providerId = body.providerId
      const config = getLLMConfig(providerId)
      if (!config.apiKey) {
        addLog('error', 'chat', 'API Key not configured', { sessionId: sid })
        await stream.writeSSE({ data: JSON.stringify({ error: '请先在设置中配置 API Key 和模型。' }) })
        return
      }

      // ─── Sentinel 输入扫描（同步阻塞） ──────────────────
      const sentinel = getSentinel()
      if (sentinel && inputText) {
        addLog('debug', 'sentinel', `开始输入安全扫描`, { sessionId: sid, agentId, input: inputText.slice(0, 100) })
        const scanResult = sentinel.scanInput(inputText, sid)
        if (!scanResult.pass) {
          addLog('warn', 'sentinel', `输入被拦截: ${scanResult.reason || 'unsafe'}`, { sessionId: sid, agentId, scanResult: JSON.stringify(scanResult), input: inputText.slice(0, 100) })
          const takeover = sentinel.scanInputWithTakeover(inputText, sid)
          const fallbackMsg = takeover.response || '输入已被安全系统拦截'
          addLog('warn', 'sentinel', `Sentinel 接管，返回安全回复`, { sessionId: sid, agentId, detail: fallbackMsg.slice(0, 100) })
          await stream.writeSSE({ data: JSON.stringify({ type: 'input_blocked', content: fallbackMsg, reason: scanResult.reason }) })
          db.prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(sid, 'assistant', `[安全拦截] ${fallbackMsg}`, new Date().toISOString())
          return
        }
        addLog('info', 'sentinel', `输入安全扫描通过`, { sessionId: sid, agentId, scanResult: JSON.stringify(scanResult) })
      }

      // ─── Sentinel 会话超时监控（30s警告→60s询问→120s接管） ────
      sentinel.startSessionTimeout(sid, agentId)
      heartbeatSender.setStatus('busy')
      heartbeatSender.setSessionCount((heartbeatSender as any).sessionCount + 1)

      // Load session history from DB for context, then append new messages
      const historyRows = db.prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at ASC').all(sid) as any[]
      const messages: any[] = historyRows
        .filter(r => r.role === 'user' || r.role === 'assistant')
        .map(r => ({ role: r.role, content: r.content }))
      // Append new messages (avoid duplicates — the user message was just saved to DB)
      const lastHistUser = historyRows.filter(r => r.role === 'user').pop()?.content
      const incomingUser = (body.messages || []).filter((m: any) => m.role === 'user').pop()
      if (incomingUser && incomingUser.content !== lastHistUser) {
        messages.push(incomingUser)
      }
      const toolDefs = (toolRegistry.getOpenAITools?.() || []).map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        input_schema: t.function.parameters,
      }))
      addLog('debug', 'chat', `Tool defs: ${toolDefs.length} tools, first 3: ${toolDefs.slice(0,3).map(t=>t.name).join(',')}`, { sessionId: sid, agentId })

      let assistantText = ''
      let thinkingText = ''

      for (let round = 0; round < maxRounds; round++) {
        let hasToolUse = false
        const toolResults: any[] = []
        let contentBlocks: any[] = []

        for await (const event of anthropicStreamWithTools(messages, toolDefs, systemPrompt)) {
          if (event.type === 'thinking') {
            thinkingText += event.thinking
            await stream.writeSSE({ data: JSON.stringify({ type: 'thinking', thinking: event.thinking }) })
          } else if (event.type === 'text') {
            assistantText += event.text
            await stream.writeSSE({ data: JSON.stringify({ choices: [{ delta: { content: event.text } }] }) })
            // Keep heartbeat alive during streaming
            sentinel?.touchSession?.(sid)
          } else if (event.type === 'done') {
            contentBlocks = event.contentBlocks
          }
        }

        // Process tool_use blocks
        for (const block of contentBlocks) {
          if (block.type !== 'tool_use') continue
          hasToolUse = true
          await stream.writeSSE({ data: JSON.stringify({ choices: [{ delta: { content: `\n[${block.name}] ` } }] }) })
          try {
            const results = await toolExec.execute([{
              id: block.id, name: block.name, args: block.input,
              type: 'function', function: { name: block.name, arguments: JSON.stringify(block.input) },
            }], { agentId, sessionKey: sid, llmConfig: getLLMConfig() })
            const resultStr = results.map((r: any) => String(r.result || r.error || '')).join('\n')
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultStr })
            addLog('info', 'tool', `工具执行成功: ${block.name}`, { sessionId: sid, agentId, toolName: block.name, toolInput: JSON.stringify(block.input).slice(0, 200), toolOutput: resultStr.slice(0, 300), duration: Date.now() - startTime })
            await stream.writeSSE({ data: JSON.stringify({ choices: [{ delta: { content: `${resultStr.slice(0, 300)}\n\n` } }] }) })
            // Keep heartbeat alive during tool execution
            sentinel?.touchSession?.(sid)
          } catch (e: any) {
            toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: `Error: ${e.message}`, is_error: true })
            addLog('error', 'tool', `Tool error: ${block.name}`, { sessionId: sid, agentId, detail: e.message })
            await stream.writeSSE({ data: JSON.stringify({ choices: [{ delta: { content: `Error: ${e.message}\n\n` } }] }) })
          }
        }

        if (!hasToolUse) break

        messages.push({ role: 'assistant', content: contentBlocks })
        messages.push({ role: 'user', content: toolResults })
      }

      // ─── Sentinel 输出扫描（同步阻塞） ──────────────────
      let finalText = assistantText
      if (sentinel && typeof assistantText === 'string' && assistantText) {
        const outputScan = sentinel.scanOutput(assistantText)
        if (!outputScan.pass) {
          const OUTPUT_FALLBACK = '抱歉，AI 响应未通过安全检查，内容已过滤。'
          addLog('warn', 'sentinel', `输出违规: ${outputScan.reason || 'unsafe'}`, { sessionId: sid, agentId, detail: outputScan.matched ? JSON.stringify(outputScan.matched) : undefined })
          await stream.writeSSE({ data: JSON.stringify({ type: 'output_replaced', fallback: OUTPUT_FALLBACK, reason: outputScan.reason }) })
          finalText = `[安全过滤] ${OUTPUT_FALLBACK}`
        } else {
          addLog('info', 'sentinel', `输出安全扫描通过`, { sessionId: sid, agentId })
        }
      }

      // Clear session timeout
      // End session timeout monitoring
      sentinel.endSessionTimeout(sid)
      heartbeatSender.setStatus('idle')
      heartbeatSender.recordResponseTime(Date.now() - startTime)

      await stream.writeSSE({ data: '[DONE]' })
      db.prepare('INSERT INTO messages (session_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(sid, 'assistant', finalText, new Date().toISOString())
      const totalDuration = Date.now() - startTime
      addLog('info', 'chat', '对话完成', { sessionId: sid, agentId, duration: totalDuration, model: config.model, provider: config.provider, output: finalText.slice(0, 200), detail: `thinking: ${thinkingText.length} chars, response: ${assistantText.length} chars, ${totalDuration}ms` })
    } catch (e: any) {
      addLog('error', 'chat', `Chat error: ${e.message}`, { sessionId: sid, agentId })
      await stream.writeSSE({ data: JSON.stringify({ error: e.message }) })
    }
  })
})

app.post('/api/chat', async (c) => {
  const { messages, providerId } = await c.req.json()
  const config = getLLMConfig(providerId)
  if (!config.apiKey) return c.json({ error: '请先在设置中配置 API Key' }, 400)
  return c.json(await chatWithConfig(messages, config))
})

// ─── Sessions ──────────────────────────────────────────

const db = getDb()
db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, title TEXT, created_at TEXT)`)
db.exec(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, role TEXT, content TEXT, created_at TEXT)`)

app.get('/api/sessions', (c) => {
  const rows = db.prepare('SELECT id, title, created_at FROM sessions ORDER BY created_at DESC').all() as any[]
  return c.json(rows.map(r => ({ id: r.id, title: r.title, createdAt: r.created_at })))
})
app.post('/api/sessions', async (c) => {
  const body = await c.req.json()
  const id = body.id || `session-${Date.now()}`
  db.prepare('INSERT OR IGNORE INTO sessions (id, title, created_at) VALUES (?, ?, ?)').run(id, body.title || '新对话', new Date().toISOString())
  addLog('info', 'session', `Session created: ${id}`, { sessionId: id })
  return c.json({ id, title: body.title || '新对话', createdAt: new Date().toISOString() })
})
app.delete('/api/sessions/:id', (c) => {
  const id = c.req.param('id')
  db.prepare('DELETE FROM sessions WHERE id = ?').run(id)
  addLog('info', 'session', `Session deleted: ${id}`, { sessionId: id })
  return c.json({ ok: true })
})

// ─── Assistant module logging middleware ───────────────────
app.use('/api/assistant/*', async (c, next) => {
  const start = Date.now()
  const method = c.req.method
  const path = new URL(c.req.url).pathname
  await next()
  const duration = Date.now() - start
  const module = path.split('/').slice(2, 4).join('/') // e.g. 'assistant/todos'
  const status = c.res.status
  addLog(status >= 400 ? 'error' : 'info', 'assistant', `${method} /${module} ${status}`, { duration })
})

app.get('/api/assistant/todos', (c) => c.json(listTodos(UID)))
app.post('/api/assistant/todos', async (c) => c.json(createTodo({ ...(await c.req.json()), userId: UID })))
app.get('/api/assistant/todos/:id', (c) => c.json(getTodo(c.req.param('id'), UID)))
app.put('/api/assistant/todos/:id', async (c) => c.json(updateTodo(c.req.param('id'), UID, await c.req.json())))
app.delete('/api/assistant/todos/:id', (c) => c.json(deleteTodo(c.req.param('id'), UID)))
app.post('/api/assistant/todos/:id/complete', (c) => c.json(completeTodo(c.req.param('id'), UID)))

// ─── Reminders (createReminder takes input object) ─────

app.get('/api/assistant/reminders', (c) => c.json(listReminders(UID)))
app.post('/api/assistant/reminders', async (c) => c.json(createReminder({ ...(await c.req.json()), userId: UID })))
app.get('/api/assistant/reminders/:id', (c) => c.json(getReminder(c.req.param('id'), UID)))
app.delete('/api/assistant/reminders/:id', (c) => c.json(deleteReminder(c.req.param('id'), UID)))
app.post('/api/assistant/reminders/:id/complete', (c) => c.json(completeReminder(c.req.param('id'), UID)))

// ─── Calendar (createEvent takes input object with startAt) ──

app.get('/api/assistant/calendar', (c) => c.json(getDayEvents(UID, new Date().toISOString().slice(0, 10))))
app.get('/api/assistant/calendar/events', (c) => c.json(getDayEvents(UID, new Date().toISOString().slice(0, 10))))
app.post('/api/assistant/calendar', async (c) => c.json(createEvent({ ...(await c.req.json()), userId: UID })))
app.post('/api/assistant/calendar/events', async (c) => c.json(createEvent({ ...(await c.req.json()), userId: UID })))
app.get('/api/assistant/calendar/:id', (c) => c.json(getEvent(c.req.param('id'), UID)))
app.put('/api/assistant/calendar/:id', async (c) => c.json(updateEvent(c.req.param('id'), UID, await c.req.json())))
app.delete('/api/assistant/calendar/:id', (c) => c.json(deleteEvent(c.req.param('id'), UID)))

// ─── Notes (createNote takes input object) ─────────────

app.get('/api/assistant/notes', (c) => c.json(listNotes(UID)))
app.post('/api/assistant/notes', async (c) => c.json(createNote({ ...(await c.req.json()), userId: UID })))
app.get('/api/assistant/notes/:id', (c) => c.json(getNote(c.req.param('id'), UID)))
app.put('/api/assistant/notes/:id', async (c) => c.json(updateNote(c.req.param('id'), UID, await c.req.json())))
app.delete('/api/assistant/notes/:id', (c) => c.json(deleteNote(c.req.param('id'), UID)))

// ─── Bookmarks (createBookmark takes input object) ──────

app.get('/api/assistant/bookmarks', (c) => c.json(listBookmarks(UID)))
app.post('/api/assistant/bookmarks', async (c) => c.json(createBookmark({ ...(await c.req.json()), userId: UID })))
app.get('/api/assistant/bookmarks/:id', (c) => c.json(getBookmark(c.req.param('id'), UID)))
app.delete('/api/assistant/bookmarks/:id', (c) => c.json(deleteBookmark(c.req.param('id'), UID)))

// ─── Habits (createHabit takes userId, name, frequency) ─

app.get('/api/assistant/habits', (c) => c.json(listHabits(UID)))
app.post('/api/assistant/habits', async (c) => {
  const body = await c.req.json()
  return c.json(createHabit(UID, body.name, body.frequency))
})
app.get('/api/assistant/habits/:id', (c) => c.json(getHabit(c.req.param('id'), UID)))
app.delete('/api/assistant/habits/:id', (c) => c.json(deleteHabit(c.req.param('id'), UID)))
app.post('/api/assistant/habits/:id/check', (c) => c.json(checkHabit(c.req.param('id'))))

// ─── Mood (logMood takes userId, mood, score, note) ─────

app.get('/api/assistant/mood', (c) => c.json(getMoodEntries(UID)))
app.post('/api/assistant/mood', async (c) => {
  const body = await c.req.json()
  return c.json(logMood(UID, body.mood, body.score, body.note))
})

// ─── Health (logHealth takes userId, type, value, unit, note) ──

app.get('/api/assistant/health', (c) => c.json(getHealthEntries(UID)))
app.post('/api/assistant/health', async (c) => {
  const body = await c.req.json()
  return c.json(logHealth(UID, body.type, body.value, body.unit, body.note))
})

// ─── Finance (logFinance takes userId, type, amount, category, note) ──

app.get('/api/assistant/finance', (c) => c.json(getFinanceEntries(UID)))
app.post('/api/assistant/finance', async (c) => {
  const body = await c.req.json()
  return c.json(logFinance(UID, body.type, body.amount, body.category, body.note))
})
app.delete('/api/assistant/finance/:id', (c) => c.json(deleteFinanceEntry(c.req.param('id'), UID)))

// ─── Goals (createGoal takes userId, title, description, targetDate) ──

app.get('/api/assistant/goals', (c) => c.json(listGoals(UID)))
app.post('/api/assistant/goals', async (c) => {
  const body = await c.req.json()
  return c.json(createGoal(UID, body.title, body.description, body.targetDate))
})
app.get('/api/assistant/goals/:id', (c) => c.json(getGoal(c.req.param('id'), UID)))
app.put('/api/assistant/goals/:id', async (c) => {
  const body = await c.req.json()
  if (body.progress !== undefined) return c.json(updateGoalProgress(c.req.param('id'), UID, body.progress))
  return c.json(getGoal(c.req.param('id'), UID))
})
app.delete('/api/assistant/goals/:id', (c) => c.json(deleteGoal(c.req.param('id'), UID)))

// ─── Reading (addReading takes userId, title, type, author) ──

app.get('/api/assistant/reading', (c) => c.json(listReadings(UID)))
app.post('/api/assistant/reading', async (c) => {
  const body = await c.req.json()
  return c.json(addReading(UID, body.title, body.type, body.author))
})
app.get('/api/assistant/reading/:id', (c) => c.json(getReading(c.req.param('id'), UID)))
app.put('/api/assistant/reading/:id', async (c) => {
  const body = await c.req.json()
  if (body.progress !== undefined) return c.json(updateReadingProgress(c.req.param('id'), UID, body.progress))
  return c.json(getReading(c.req.param('id'), UID))
})
app.delete('/api/assistant/reading/:id', (c) => c.json(deleteReading(c.req.param('id'), UID)))

// ─── Learning (createCourse(userId, name, totalHours)) ──

app.get('/api/assistant/learning', (c) => c.json(listCourses(UID)))
app.get('/api/assistant/learning/courses', (c) => c.json(listCourses(UID)))
app.post('/api/assistant/learning', async (c) => {
  const body = await c.req.json()
  return c.json(createCourse(UID, body.name, body.totalHours))
})
app.post('/api/assistant/learning/courses', async (c) => {
  const body = await c.req.json()
  return c.json(createCourse(UID, body.name, body.totalHours))
})
app.get('/api/assistant/learning/:id', (c) => c.json(getCourse(c.req.param('id'), UID)))
app.get('/api/assistant/learning/courses/:id', (c) => c.json(getCourse(c.req.param('id'), UID)))
app.put('/api/assistant/learning/:id', async (c) => {
  const body = await c.req.json()
  if (body.completedHours !== undefined) return c.json(updateProgress(c.req.param('id'), UID, body.completedHours))
  return c.json(getCourse(c.req.param('id'), UID))
})
app.delete('/api/assistant/learning/:id', (c) => c.json(deleteCourse(c.req.param('id'), UID)))
app.delete('/api/assistant/learning/courses/:id', (c) => c.json(deleteCourse(c.req.param('id'), UID)))

// ─── Inspiration (addInspiration takes userId, content, tags) ──

app.get('/api/assistant/inspiration', (c) => c.json(listInspirations(UID)))
app.post('/api/assistant/inspiration', async (c) => {
  const body = await c.req.json()
  return c.json(addInspiration(UID, body.content, body.tags))
})
app.get('/api/assistant/inspiration/:id', (c) => c.json(getInspiration(c.req.param('id'), UID)))
app.delete('/api/assistant/inspiration/:id', (c) => c.json(deleteInspiration(c.req.param('id'), UID)))

// ─── Contacts (createContact takes userId, name, options) ──

app.get('/api/assistant/contacts', (c) => c.json(listContacts(UID)))
app.post('/api/assistant/contacts', async (c) => {
  const body = await c.req.json()
  return c.json(createContact(UID, body.name, body))
})
app.get('/api/assistant/contacts/:id', (c) => c.json(getContact(c.req.param('id'), UID)))
app.put('/api/assistant/contacts/:id', async (c) => c.json(updateContact(c.req.param('id'), UID, await c.req.json())))
app.delete('/api/assistant/contacts/:id', (c) => c.json(deleteContact(c.req.param('id'), UID)))

// ─── Projects (createProject takes userId, name, description) ──

app.get('/api/assistant/projects', (c) => c.json(listProjects(UID)))
app.post('/api/assistant/projects', async (c) => {
  const body = await c.req.json()
  return c.json(createProject(UID, body.name, body.description))
})
app.get('/api/assistant/projects/:id', (c) => c.json(getProject(c.req.param('id'), UID)))
app.put('/api/assistant/projects/:id', async (c) => c.json(updateProject(c.req.param('id'), UID, await c.req.json())))
app.delete('/api/assistant/projects/:id', (c) => c.json(deleteProject(c.req.param('id'), UID)))

// ─── Passwords (createPasswordEntry takes userId, name, password, options) ──

app.get('/api/assistant/passwords', (c) => c.json(listPasswordEntries(UID)))
app.get('/api/assistant/passwords/generate', (c) => c.json({ password: generatePassword(20) }))
app.post('/api/assistant/passwords', async (c) => {
  const body = await c.req.json()
  return c.json(createPasswordEntry(UID, body.name, body.password, body))
})
app.get('/api/assistant/passwords/:id', (c) => c.json(getPasswordEntry(c.req.param('id'), UID)))
app.put('/api/assistant/passwords/:id', async (c) => c.json(updatePasswordEntry(c.req.param('id'), UID, await c.req.json())))
app.delete('/api/assistant/passwords/:id', (c) => c.json(deletePasswordEntry(c.req.param('id'), UID)))
app.get('/api/assistant/passwords/:id/reveal', (c) => c.json({ password: getPassword(c.req.param('id'), UID) }))

// ─── Time Tracker (startTimeLog(userId, activity, category, note)) ──

app.get('/api/assistant/timetracker', (c) => c.json(getTimeLogs(UID)))
app.get('/api/assistant/time-tracker', (c) => c.json(getTimeLogs(UID)))
app.get('/api/assistant/timetracker/active', (c) => c.json(getActiveTimeLogs(UID)))
app.get('/api/assistant/time-tracker/active', (c) => c.json(getActiveTimeLogs(UID)))
app.post('/api/assistant/timetracker', async (c) => {
  const body = await c.req.json()
  return c.json(startTimeLog(UID, body.activity, body.category, body.note))
})
app.post('/api/assistant/time-tracker/start', async (c) => {
  const b = await c.req.json()
  return c.json(startTimeLog(UID, b.task, b.category, b.note))
})
app.put('/api/assistant/timetracker/:id', (c) => c.json(endTimeLog(c.req.param('id'), UID)))
app.put('/api/assistant/time-tracker/:id/stop', (c) => c.json(endTimeLog(c.req.param('id'), UID)))
app.delete('/api/assistant/timetracker/:id', (c) => c.json(deleteTimeLog(c.req.param('id'), UID)))
app.delete('/api/assistant/time-tracker/:id', (c) => c.json(deleteTimeLog(c.req.param('id'), UID)))

// ─── Stats & Extended API ──────────────────────────────

app.get('/api/assistant/mood/stats', (c) => c.json(getMoodStats(UID)))
app.get('/api/assistant/finance/stats', (c) => c.json(getFinanceStats(UID)))
app.get('/api/assistant/finance/monthly-stats', (c) => c.json(getMonthlyStats(UID)))
app.get('/api/assistant/health/stats', (c) => c.json(getHealthStats(UID)))
app.get('/api/assistant/todos/today', (c) => c.json(getTodayTodos(UID)))
app.get('/api/assistant/habits/:id/streak', (c) => c.json({ streak: getStreak(c.req.param('id')) }))
app.get('/api/assistant/habits/:id/logs', (c) => c.json(getHabitLogs(c.req.param('id'))))
app.get('/api/assistant/habits/:id/today', (c) => c.json({ checked: isTodayChecked(c.req.param('id')) }))
app.get('/api/assistant/timetracker/stats', (c) => c.json(getTimeStats(UID)))
app.get('/api/assistant/notes/search', async (c) => c.json(searchNotes(UID, c.req.query('q') || '')))
app.get('/api/assistant/notes/tags', (c) => c.json(getAllTags(UID)))
app.get('/api/assistant/bookmarks/search', async (c) => c.json(searchBookmarks(UID, c.req.query('q') || '')))
app.get('/api/assistant/contacts/search', async (c) => c.json(searchContacts(UID, c.req.query('q') || '')))
app.get('/api/assistant/inspiration/search', async (c) => c.json(searchInspirations(UID, c.req.query('q') || '')))
app.get('/api/assistant/calendar/week', (c) => c.json(getWeekEvents(UID)))
app.get('/api/assistant/calendar/month', (c) => c.json(getMonthEvents(UID)))
app.put('/api/assistant/reminders/:id/cancel', (c) => c.json({ ok: cancelReminder(c.req.param('id'), UID) }))
app.post('/api/assistant/contacts/:id/interact', (c) => c.json(recordInteraction(c.req.param('id'), UID)))

// ─── Agents ────────────────────────────────────────────

app.get('/api/agents', (c) => c.json(listAgents()))
app.post('/api/agents', async (c) => {
  const body = await c.req.json()
  const agent = createAgent({ name: body.name, soul_content: body.soul_content, primary_model_id: body.primary_model_id, temperature: body.temperature })
  bootstrapWorkspace(agent.id)
  addLog('info', 'agent', `Agent 创建: ${agent.name}`, { agentId: agent.id, detail: `name: ${agent.name}, model: ${agent.primary_model_id || 'default'}` })
  return c.json(agent)
})
app.get('/api/agents/:id', (c) => {
  const agent = getAgent(c.req.param('id'))
  return agent ? c.json(agent) : c.json({ error: 'Agent not found' }, 404)
})
app.put('/api/agents/:id', async (c) => {
  const id = c.req.param('id')
  const updates = await c.req.json()
  // If soul_content updated via API, reverse-sync to workspace json files
  if (updates.soul_content) {
    try {
      const s = JSON.parse(updates.soul_content)
      const identity = readWorkspaceJson(id, 'identity.json') || {}
      if (s.role) identity.role = s.role
      writeWorkspaceJson(id, 'identity.json', identity)
      const soul = readWorkspaceJson(id, 'soul.json') || {}
      if (s.personality) soul.personality = s.personality
      if (s.rules) soul.rules = s.rules
      writeWorkspaceJson(id, 'soul.json', soul)
      const tools = readWorkspaceJson(id, 'tools.json') || {}
      if (s.skills) tools.skills = s.skills
      writeWorkspaceJson(id, 'tools.json', tools)
    } catch { /* ignore parse error */ }
  }
  const result = updateAgent(id, updates)
  if (result) addLog('info', 'agent', `Agent 更新: ${result.name}`, { agentId: result.id, detail: `fields: ${Object.keys(updates).join(', ')}` })
  return result ? c.json(result) : c.json({ error: 'Agent not found' }, 404)
})
app.delete('/api/agents/:id', (c) => {
  const id = c.req.param('id')
  const ok = deleteAgent(id)
  if (ok) addLog('info', 'agent', `Agent 删除: ${id}`, { agentId: id })
  return c.json({ ok })
})
app.post('/api/agents/:id/start', (c) => {
  const id = c.req.param('id')
  updateAgent(id, { status: 'active' })
  addLog('info', 'agent', `Agent started: ${id}`, { agentId: id })
  return c.json({ ok: true, agentId: id })
})
app.post('/api/agents/:id/stop', (c) => {
  const id = c.req.param('id')
  updateAgent(id, { status: 'stopped' })
  addLog('info', 'agent', `Agent stopped: ${id}`, { agentId: id })
  return c.json({ ok: true, agentId: id })
})
// ─── Agent Workspace (identity.json / soul.json / user.json / tools.json) ──
app.get('/api/agents/:id/workspace', (c) => {
  const id = c.req.param('id')
  const result: Record<string, any> = {}
  for (const f of ['identity.json', 'soul.json', 'user.json', 'tools.json']) {
    result[f] = readWorkspaceJson(id, f) || {}
  }
  return c.json(result)
})
app.put('/api/agents/:id/workspace/:file', async (c) => {
  const id = c.req.param('id')
  const filename = c.req.param('file')
  if (!['identity.json', 'soul.json', 'user.json', 'tools.json'].includes(filename)) {
    return c.json({ error: 'Invalid file' }, 400)
  }
  const { content } = await c.req.json()
  writeWorkspaceJson(id, filename, content)
  syncSoulFromWorkspace(id)
  addLog('info', 'agent', `工作区文件已更新: ${filename}`, { agentId: id, detail: JSON.stringify(content).slice(0, 200) })
  return c.json({ ok: true })
})

// ─── Log System ────────────────────────────────────────
interface LogEntry {
  id: string; timestamp: string; level: 'info' | 'warn' | 'error' | 'debug'
  category: string; message: string; detail?: string; sessionId?: string
  agentId?: string; duration?: number; input?: string; output?: string;
  model?: string; provider?: string; tokensIn?: number; tokensOut?: number;
  toolName?: string; toolInput?: string; toolOutput?: string; scanResult?: string;
}
const MAX_LOGS = 2000
const logs: LogEntry[] = []
function addLog(level: LogEntry['level'], category: string, message: string, opts?: Partial<LogEntry>) {
  const entry: LogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(), level, category, message,
    detail: opts?.detail, sessionId: opts?.sessionId, agentId: opts?.agentId,
    duration: opts?.duration, input: opts?.input, output: opts?.output,
    model: opts?.model, provider: opts?.provider,
    tokensIn: opts?.tokensIn, tokensOut: opts?.tokensOut,
    toolName: opts?.toolName, toolInput: opts?.toolInput, toolOutput: opts?.toolOutput,
    scanResult: opts?.scanResult,
  }
  logs.push(entry)
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS)
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'debug' ? '🔍' : '✅'
  console.log(`[${entry.timestamp.slice(11, 19)}] ${prefix} [${category}] ${message}${opts?.duration ? ` (${opts.duration}ms)` : ''}${opts?.model ? ` model=${opts.model}` : ''}${opts?.toolName ? ` tool=${opts.toolName}` : ''}`)
}

app.get('/api/logs', (c) => {
  const level = c.req.query('level')
  const category = c.req.query('category')
  const limit = parseInt(c.req.query('limit') || '200')
  let filtered = logs
  if (level) filtered = filtered.filter(l => l.level === level)
  if (category) filtered = filtered.filter(l => l.category === category)
  return c.json({ total: filtered.length, logs: filtered.slice(-limit).reverse() })
})
app.delete('/api/logs', (c) => {
  const count = logs.length
  logs.length = 0
  addLog('info', 'system', `Logs cleared (${count} entries)`)
  return c.json({ ok: true, cleared: count })
})

// ─── Sentinel ──────────────────────────────────────────

const sentinel = getSentinel()
// 启动母Agent环路守护：心跳监控、超时监控、自检
sentinel.start()
// 母Agent自身心跳：每秒更新事件循环活跃状态
setInterval(() => sentinel.beat(), 1000)
addLog('info', 'sentinel', 'Sentinel initialized + loop guardian started (heartbeat, timeout, self-check)')

// 注入 LLMProvider 给 Layer 2 (InferenceAgent) 和 Layer 3 (LegalGuidanceGenerator)
let sentinelLLMProvider = new LLMPoolProvider('sentinel', getSentinelLLMConfig())
sentinel.setLLMProvider(sentinelLLMProvider)
addLog('info', 'sentinel', `Sentinel LLMProvider initialized (provider: ${getSentinelLLMConfig().provider}, model: ${getSentinelLLMConfig().model})`)

// 父Agent心跳发送器（每2秒发心跳给母Agent）
const heartbeatSender = new HeartbeatSender(DEFAULT_AGENT_ID)
heartbeatSender.setOnSend((heartbeat) => {
  sentinel.receiveHeartbeat(heartbeat)
})
heartbeatSender.start()
addLog('info', 'sentinel', 'Parent agent heartbeat sender started (2s interval)')

// 接管回复生成器（用LLM生成自然接管回复）
const takeoverGenerator = new LLMTakeoverGenerator()
takeoverGenerator.setLLMClient({
  chat: async (messages) => {
    const config = getLLMConfig()
    const result = await chatWithConfig(
      messages.map(m => ({ role: m.role as any, content: m.content })),
      config,
      { maxTokens: 256, temperature: 0.5 }
    )
    return typeof result.content === 'string' ? result.content : ''
  }
})
// 注册接管回复生成器到全局管理器
const takeoverMgr = getTakeoverMessageManager()
takeoverMgr.setGenerator(takeoverGenerator)
addLog('info', 'sentinel', 'LLM takeover generator initialized')

// 接管信号接收器（监听母Agent的接管/恢复信号）
const signalReceiver = sentinel.createSignalReceiver(DEFAULT_AGENT_ID)
signalReceiver.start({
  onTakeover: (signal) => {
    addLog('warn', 'sentinel', `母Agent接管! 原因: ${signal.reason}`, { sessionId: signal.sessionId })
  },
  onResume: (signal) => {
    addLog('info', 'sentinel', `母Agent恢复控制`, { sessionId: signal.sessionId })
  },
})

app.post('/api/sentinel/scan', async (c) => {
  const body = await c.req.json()
  const input = body.input || body.message
  addLog('info', 'sentinel', `Manual scan requested`, { sessionId: body.sessionId, detail: input?.slice(0, 100) })
  try {
    const result = await sentinel.fullScan(input, body.sessionId)
    const level = result.pass === false ? 'warn' : 'info'
    const detail = result.layers ? Object.entries(result.layers).map(([k, v]) => `${k}: ${v.pass ? 'pass' : v.reason || 'blocked'}`).join('; ') : ''
    addLog(level, 'sentinel', `Scan result: ${result.pass === false ? 'BLOCKED' : 'passed'}`, { sessionId: body.sessionId, detail })
    return c.json(result)
  } catch (e: any) {
    addLog('error', 'sentinel', `Scan failed: ${e.message}`, { sessionId: body.sessionId })
    return c.json({ error: e.message }, 500)
  }
})
app.get('/api/sentinel/status', (c) => {
  const status = sentinel ? {
    active: true,
    layers: {
      vocabulary: { active: true, description: '词汇层：过滤危险关键词' },
      intent: { active: true, description: '意图层：LLM 分析恶意意图' },
      legal: { active: true, description: '法律层：法律知识库合规审查' },
    },
    heartbeats: sentinel.getAgentHealthStatus(DEFAULT_AGENT_ID)
      ? Object.fromEntries(
          [sentinel.getAgentHealthStatus(DEFAULT_AGENT_ID)]
            .filter(Boolean)
            .map(s => [s.agentId, s])
        )
      : {},
    selfHealth: sentinel.getSelfHealthStatus(),
    timeoutSessions: sentinel.getTimeoutMessages(),
  } : { active: false }
  addLog('debug', 'sentinel', 'Status queried')
  return c.json(status)
})
app.get('/api/sentinel/timeout/:sessionId', (c) => {
  const sid = c.req.param('sessionId')
  const state = sentinel.getSessionTimeoutState(sid)
  return c.json(state || { status: 'not_monitored' })
})
app.get('/api/sentinel/stats', (c) => {
  const sentinelLogs = logs.filter(l => l.category === 'sentinel')
  let inputTotal = 0, inputBlocked = 0, outputTotal = 0, outputViolated = 0, manualTotal = 0
  const recent: any[] = []
  for (let i = sentinelLogs.length - 1; i >= 0; i--) {
    const l = sentinelLogs[i]
    const msg = l.message || ''
    if (msg.includes('输入安全扫描通过') || msg.includes('输入被拦截')) {
      inputTotal++
      if (msg.includes('输入被拦截')) inputBlocked++
      if (recent.length < 30) recent.push({ time: l.timestamp, type: 'input', pass: !msg.includes('拦截'), reason: l.detail || l.scanResult || '', sessionId: l.sessionId })
    } else if (msg.includes('输出安全扫描通过') || msg.includes('输出违规')) {
      outputTotal++
      if (msg.includes('输出违规')) outputViolated++
      if (recent.length < 30) recent.push({ time: l.timestamp, type: 'output', pass: !msg.includes('违规'), reason: l.detail || l.scanResult || '', sessionId: l.sessionId })
    } else if (msg.includes('Manual scan')) {
      manualTotal++
    }
  }
  return c.json({ inputTotal, inputBlocked, outputTotal, outputViolated, manualTotal, recent })
})
app.get('/api/sentinel/logs', (c) => {
  const sentinelLogs = logs.filter(l => l.category === 'sentinel').slice(-100).reverse()
  return c.json(sentinelLogs)
})

// ─── Search ───────────────────────────────────────────

app.get('/api/search', async (c) => {
  const q = c.req.query('q')
  if (!q) return c.json({ error: 'Missing query' }, 400)
  const startTime = Date.now()
  addLog('info', 'search', `Search query: ${q}`)
  try {
    const results = await search(q)
    addLog('info', 'search', `Search completed: ${q}`, { duration: Date.now() - startTime })
    return c.json(results)
  } catch (e: any) {
    addLog('error', 'search', `Search failed: ${e.message}`, { detail: q })
    return c.json({ error: e.message }, 500)
  }
})

app.get('/api/search/config', (c) => {
  try {
    const saved = loadSettings()
    return c.json({ engine: saved.searchEngine || 'none', searxngUrl: saved.searxngUrl || '' })
  } catch { return c.json({ engine: 'none' }) }
})

// ─── Charter ───────────────────────────────────────────

app.get('/api/charters', (c) => {
  const builtin = listBuiltinCharterTypes().map(t => ({ id: t, name: t, type: t, builtin: true, ...getBuiltinCharter(t) }))
  return c.json(builtin)
})
app.get('/api/charters/builtin-types', (c) => c.json(listBuiltinCharterTypes()))
app.get('/api/charters/types', (c) => c.json(listBuiltinCharterTypes()))
app.get('/api/libraries', (c) => {
  const builtin = listBuiltinLibraries().map(n => ({ id: n, name: n, builtin: true, ...getBuiltinLibrary(n) }))
  return c.json(builtin)
})

// ─── Skills ────────────────────────────────────────────

app.get('/api/skills', async (c) => {
  try { return c.json(await listSkills()) } catch { return c.json([]) }
})

// ─── Settings ──────────────────────────────────────────

app.get('/api/settings', (c) => c.json(loadSettings()))
app.put('/api/settings', async (c) => {
  const body = await c.req.json()
  const current = loadSettings()
  const merged = { ...current, ...body }
  saveSettingsToFile(merged)
  addLog('info', 'settings', 'Settings updated', { detail: Object.keys(body).join(', ') })
  // Apply search config change
  if (body.searchEngine && body.searchEngine !== 'none') {
    try {
      configureSearch({ engine: body.searchEngine, baseUrl: body.searxngUrl || 'http://127.0.0.1:8080' })
      addLog('info', 'search', `Search engine configured: ${body.searchEngine}`)
    } catch (e: any) {
      addLog('error', 'search', `Search config failed: ${e.message}`)
    }
  }
  // Apply sentinel LLM config change
  if (body.sentinelLlmProvider !== undefined || body.sentinelApiKey !== undefined || body.sentinelModel !== undefined || body.sentinelApiEndpoint !== undefined) {
    const newConfig = getSentinelLLMConfig()
    sentinelLLMProvider.updateConfig(newConfig)
    addLog('info', 'sentinel', `Sentinel LLMProvider updated (provider: ${newConfig.provider}, model: ${newConfig.model})`)
  }
  return c.json({ ok: true })
})
app.get('/api/settings/sounds', (c) => {
  const sounds: string[] = []
  const sysDir = '/System/Library/Sounds'
  const userDir = join(homedir(), 'Library', 'Sounds')
  for (const dir of [sysDir, userDir]) {
    try {
      for (const f of readdirSync(dir)) {
        if (f.endsWith('.aiff') || f.endsWith('.wav') || f.endsWith('.mp3')) {
          sounds.push(f.replace(/\.(aiff|wav|mp3)$/, ''))
        }
      }
    } catch {}
  }
  return c.json(sounds.sort())
})
app.post('/api/settings/export', (c) => c.json({ exportedAt: new Date().toISOString() }))
app.post('/api/settings/import', (c) => c.json({ imported: true }))

// ─── Start ─────────────────────────────────────────────

serve({ fetch: app.fetch, port: PORT })
console.log(`Sidecar ready on port ${PORT}`)
writeFileSync(join(tmpdir(), 'nexusmind-sidecar-port'), String(PORT))
addLog('info', 'system', `Sidecar started on port ${PORT}`)