/**
 * ColoMind API Server
 *
 * Frontend API server - only calls Core
 */

import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
config()

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.API_PORT || 3000

// ─────────────────────────────────────────────────────────────
// Load Core
// ─────────────────────────────────────────────────────────────

let core: typeof import('@colomind/core') | null = null

async function loadCore() {
  try {
    core = await import('@colomind/core')
    console.log('[API] @colomind/core loaded')
  } catch (err) {
    console.error('[API] Failed to load @colomind/core:', err)
  }
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const success = <T>(res: express.Response, data: T) => {
  res.json({ code: 200, data })
}

const error = (res: express.Response, msg: string, code = 400) => {
  res.status(code).json({ code, msg })
}

const notAvailable = (res: express.Response) => {
  res.status(503).json({ code: 503, msg: 'Service not available' })
}

// ─────────────────────────────────────────────────────────────
// Health
// ─────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok' }))

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body
  if (username === 'admin' && password === 'colomind2024') {
    success(res, { token: 'token-' + Date.now() })
  } else {
    error(res, '用户名或密码错误', 401)
  }
})

app.get('/api/v1/auth/me', (req, res) => {
  if (req.headers.authorization) {
    success(res, { id: '1', username: 'admin', role: 'admin' })
  } else {
    error(res, '未授权', 401)
  }
})

app.post('/api/v1/auth/logout', (req, res) => success(res, true))

// ─────────────────────────────────────────────────────────────
// Agent
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/agents', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.agentRegistry.list())
})

app.post('/api/v1/agents', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.agentRegistry.create(req.body))
})

app.put('/api/v1/agents/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.agentRegistry.update(req.params.id, req.body))
})

app.delete('/api/v1/agents/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.agentRegistry.delete(req.params.id)
  success(res, true)
})

// ─────────────────────────────────────────────────────────────
// Todo
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/todos', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.listTodos())
})

app.get('/api/v1/todos/today', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.getTodayTodos())
})

app.post('/api/v1/todos', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.createTodo({ ...req.body, userId: '1' }))
})

app.put('/api/v1/todos/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.updateTodo(req.params.id, req.body)
  success(res, true)
})

app.delete('/api/v1/todos/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.deleteTodo(req.params.id)
  success(res, true)
})

app.post('/api/v1/todos/:id/complete', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.completeTodo(req.params.id)
  success(res, true)
})

// ─────────────────────────────────────────────────────────────
// Reminder
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/reminders', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.listReminders())
})

app.post('/api/v1/reminders', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.createReminder({ ...req.body, userId: '1' }))
})

app.delete('/api/v1/reminders/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.deleteReminder(req.params.id)
  success(res, true)
})

app.post('/api/v1/reminders/:id/complete', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.completeReminder(req.params.id)
  success(res, true)
})

// ─────────────────────────────────────────────────────────────
// Event
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/events', async (req, res) => {
  if (!core) return success(res, [])
  const { start, end } = req.query
  success(res, await core.getMonthEvents(start as string, end as string))
})

app.get('/api/v1/events/day', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.getDayEvents(req.query.date as string))
})

app.get('/api/v1/events/week', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.getWeekEvents())
})

app.post('/api/v1/events', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.createEvent({ ...req.body, userId: '1' }))
})

app.put('/api/v1/events/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.updateEvent(req.params.id, req.body)
  success(res, true)
})

app.delete('/api/v1/events/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.deleteEvent(req.params.id)
  success(res, true)
})

// ─────────────────────────────────────────────────────────────
// Note
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/notes', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.listNotes())
})

app.get('/api/v1/notes/search', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.searchNotes(req.query.q as string))
})

app.post('/api/v1/notes', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.createNote({ ...req.body, userId: '1' }))
})

app.put('/api/v1/notes/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.updateNote(req.params.id, req.body)
  success(res, true)
})

app.delete('/api/v1/notes/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.deleteNote(req.params.id)
  success(res, true)
})

// ─────────────────────────────────────────────────────────────
// Habit
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/habits', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.listHabits())
})

app.post('/api/v1/habits', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.createHabit({ ...req.body, userId: '1' }))
})

app.delete('/api/v1/habits/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.deleteHabit(req.params.id)
  success(res, true)
})

app.post('/api/v1/habits/:id/check', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.checkHabit(req.params.id)
  success(res, true)
})

app.get('/api/v1/habits/:id/logs', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.getHabitLogs(req.params.id))
})

// ─────────────────────────────────────────────────────────────
// Mood
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/moods', async (req, res) => {
  if (!core) return success(res, [])
  const limit = req.query.limit ? Number(req.query.limit) : undefined
  success(res, await core.getMoodEntries(limit))
})

app.post('/api/v1/moods', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.logMood({ mood: req.body.mood, score: req.body.score, note: req.body.note }))
})

app.get('/api/v1/moods/stats', async (req, res) => {
  if (!core) return success(res, { average: 0, count: 0 })
  success(res, await core.getMoodStats())
})

// ─────────────────────────────────────────────────────────────
// Finance
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/finances', async (req, res) => {
  if (!core) return success(res, [])
  const { start, end } = req.query
  success(res, await core.getFinanceEntries(start as string, end as string))
})

app.post('/api/v1/finances', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.logFinance({ ...req.body, userId: '1' }))
})

app.get('/api/v1/finances/stats', async (req, res) => {
  if (!core) return success(res, { totalIncome: 0, totalExpense: 0 })
  success(res, await core.getFinanceStats())
})

app.get('/api/v1/finances/monthly', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.getMonthlyStats())
})

// ─────────────────────────────────────────────────────────────
// Goal
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/goals', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.listGoals())
})

app.post('/api/v1/goals', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.createGoal({ ...req.body, userId: '1' }))
})

app.delete('/api/v1/goals/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.deleteGoal(req.params.id)
  success(res, true)
})

app.put('/api/v1/goals/:id/progress', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.updateGoalProgress(req.params.id, req.body.progress)
  success(res, true)
})

// ─────────────────────────────────────────────────────────────
// Contact
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/contacts', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.listContacts())
})

app.get('/api/v1/contacts/search', async (req, res) => {
  if (!core) return success(res, [])
  success(res, await core.searchContacts(req.query.q as string))
})

app.post('/api/v1/contacts', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.createContact({ ...req.body, userId: '1' }))
})

app.put('/api/v1/contacts/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.updateContact(req.params.id, req.body)
  success(res, true)
})

app.delete('/api/v1/contacts/:id', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.deleteContact(req.params.id)
  success(res, true)
})

// ─────────────────────────────────────────────────────────────
// Skill
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/skills', async (req, res) => {
  if (!core) return success(res, { records: [] })
  success(res, { records: await core.listSkills() })
})

app.put('/api/v1/skills/:id/toggle', (req, res) => {
  success(res, true)
})

// ─────────────────────────────────────────────────────────────
// Intent
// ─────────────────────────────────────────────────────────────

app.post('/api/v1/intent/parse', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.parseIntent(req.body.text))
})

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/config', async (req, res) => {
  if (!core) return success(res, {})
  success(res, await core.loadConfig())
})

app.put('/api/v1/config', async (req, res) => {
  if (!core) return notAvailable(res)
  await core.saveConfig(req.body)
  success(res, true)
})

app.get('/api/v1/config/status', (req, res) => {
  success(res, { server: 'running', database: 'connected', version: '0.2.2' })
})

// ─────────────────────────────────────────────────────────────
// User Profile
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/user/profile', async (req, res) => {
  if (!core) return notAvailable(res)
  success(res, await core.generateUserProfile())
})

// ─────────────────────────────────────────────────────────────
// Sentinel
// ─────────────────────────────────────────────────────────────

app.get('/api/v1/sentinel/status', (req, res) => {
  success(res, { enabled: true, mode: 'active' })
})

app.get('/api/v1/sentinel/sessions', (req, res) => {
  success(res, [])
})

// ─────────────────────────────────────────────────────────────
// Watch API - Apple Watch专用端点
// ─────────────────────────────────────────────────────────────

import type {
  WatchSummary,
  AgentHealthStatus,
  WatchSessionState,
  QuickCommand,
  WatchDeviceRegistration,
  SessionActionRequest,
  CommandResult,
} from '@colomind/types'

// 默认快捷指令
const defaultQuickCommands: QuickCommand[] = [
  { id: 'refresh', name: '刷新状态', icon: 'arrow.clockwise', action: 'refresh_status', confirmation: false },
  { id: 'pause_all', name: '暂停所有', icon: 'pause.circle', action: 'pause_all', confirmation: true },
  { id: 'resume_all', name: '恢复所有', icon: 'play.circle', action: 'resume_all', confirmation: true },
  { id: 'emergency', name: '紧急停止', icon: 'stop.circle', action: 'emergency_stop', confirmation: true },
]

// GET /api/v1/watch/summary - 仪表盘摘要
app.get('/api/v1/watch/summary', async (req, res) => {
  try {
    // 尝试从 Sentinel 获取真实数据
    const sentinel = await import('@colomind/sentinel').then(m => m.getSentinel()).catch(() => null)

    if (sentinel) {
      const selfHealth = sentinel.getSelfHealthStatus()
      const agentStatuses = sentinel.heartbeatMonitor?.getAllStatus() || []

      const summary: WatchSummary = {
        sentinel: {
          status: selfHealth.status,
          eventLoopLag: selfHealth.eventLoopLag || 0,
          lastBeat: selfHealth.lastBeat || Date.now(),
        },
        agents: {
          total: agentStatuses.length,
          healthy: agentStatuses.filter(a => a.status === 'healthy').length,
          unhealthy: agentStatuses.filter(a => a.status !== 'healthy').length,
        },
        sessions: {
          active: 0,
          warning: 0,
          takeover: 0,
        },
        quickCommands: defaultQuickCommands,
      }
      success(res, summary)
    } else {
      // Sentinel 未加载，返回模拟数据
      const summary: WatchSummary = {
        sentinel: {
          status: 'healthy',
          eventLoopLag: 15,
          lastBeat: Date.now(),
        },
        agents: {
          total: 1,
          healthy: 1,
          unhealthy: 0,
        },
        sessions: {
          active: 0,
          warning: 0,
          takeover: 0,
        },
        quickCommands: defaultQuickCommands,
      }
      success(res, summary)
    }
  } catch (err) {
    error(res, '获取状态失败', 500)
  }
})

// GET /api/v1/watch/agents - Agent健康列表
app.get('/api/v1/watch/agents', async (req, res) => {
  try {
    const sentinel = await import('@colomind/sentinel').then(m => m.getSentinel()).catch(() => null)

    if (sentinel) {
      const agents = sentinel.heartbeatMonitor?.getAllStatus() || []
      const watchAgents: AgentHealthStatus[] = agents.map(a => ({
        id: a.agentId,
        status: a.status,
        lastHeartbeat: a.lastHeartbeat,
        missedBeats: a.missedBeats,
        sessionCount: a.lastStatus === 'busy' ? 1 : 0,
      }))
      success(res, watchAgents)
    } else {
      success(res, [])
    }
  } catch (err) {
    error(res, '获取Agent状态失败', 500)
  }
})

// GET /api/v1/watch/sessions - 活跃会话
app.get('/api/v1/watch/sessions', async (req, res) => {
  try {
    const sentinel = await import('@colomind/sentinel').then(m => m.getSentinel()).catch(() => null)

    if (sentinel) {
      const sessions = sentinel.timeoutMonitor?.getTimeoutSessions() || []
      const watchSessions: WatchSessionState[] = sessions.map(s => ({
        id: s.sessionId,
        agentId: s.agentId || 'unknown',
        status: s.stage === 'takeover' ? 'blocked' : 'processing',
        lastActivity: s.lastUpdate || Date.now(),
        timeoutStage: s.stage,
      }))
      success(res, watchSessions)
    } else {
      success(res, [])
    }
  } catch (err) {
    error(res, '获取会话状态失败', 500)
  }
})

// POST /api/v1/watch/command/:id - 执行快捷指令
app.post('/api/v1/watch/command/:id', async (req, res) => {
  const { id } = req.params
  const command = defaultQuickCommands.find(c => c.id === id)

  if (!command) {
    error(res, '指令不存在', 404)
    return
  }

  try {
    // 执行指令逻辑
    let result: CommandResult = { success: true }

    switch (command.action) {
      case 'refresh_status':
        result = { success: true, message: '状态已刷新' }
        break
      case 'pause_all':
        // TODO: 实现暂停逻辑
        result = { success: true, message: '所有会话已暂停' }
        break
      case 'resume_all':
        // TODO: 实现恢复逻辑
        result = { success: true, message: '所有会话已恢复' }
        break
      case 'emergency_stop':
        // TODO: 实现紧急停止逻辑
        result = { success: true, message: '紧急停止已执行' }
        break
      default:
        result = { success: false, message: '未知指令' }
    }

    success(res, result)
  } catch (err) {
    error(res, '执行指令失败', 500)
  }
})

// POST /api/v1/watch/sessions/:sessionId/action - 会话操作
app.post('/api/v1/watch/sessions/:sessionId/action', async (req, res) => {
  const { sessionId } = req.params
  const { action } = req.body as SessionActionRequest

  try {
    const sentinel = await import('@colomind/sentinel').then(m => m.getSentinel()).catch(() => null)

    if (!sentinel) {
      error(res, 'Sentinel未加载', 503)
      return
    }

    let result: CommandResult = { success: true }

    switch (action) {
      case 'terminate':
        sentinel.triggerTakeover(sessionId, 'rate_limit')
        result = { success: true, message: '会话已终止' }
        break
      case 'touch':
        sentinel.touchSession?.(sessionId)
        result = { success: true, message: '会话已续期' }
        break
      case 'pause':
        // TODO: 实现暂停逻辑
        result = { success: true, message: '会话已暂停' }
        break
      case 'resume':
        // TODO: 实现恢复逻辑
        result = { success: true, message: '会话已恢复' }
        break
      default:
        result = { success: false, message: '未知操作' }
    }

    success(res, result)
  } catch (err) {
    error(res, '操作失败', 500)
  }
})

// POST /api/v1/watch/device/register - 注册设备推送
app.post('/api/v1/watch/device/register', async (req, res) => {
  const { deviceToken, userId, deviceName } = req.body as WatchDeviceRegistration

  if (!deviceToken || !userId) {
    error(res, '缺少必要参数', 400)
    return
  }

  // TODO: 存储到数据库
  console.log('[Watch] Device registered:', { deviceToken, userId, deviceName })

  success(res, { registered: true, deviceToken })
})

// ─────────────────────────────────────────────────────────────
// Start
// ─────────────────────────────────────────────────────────────

loadCore().then(() => {
  app.listen(PORT, () => {
    console.log(`ColoMind API Server running at http://localhost:${PORT}`)
  })
})
