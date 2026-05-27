import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'
import { serve } from '@hono/node-server'
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir, homedir } from 'os'
import {
  getDb,
  createTodo, getTodo, updateTodo, deleteTodo, listTodos, completeTodo,
  createReminder, getReminder, listReminders, deleteReminder, completeReminder,
  createEvent, getEvent, updateEvent, deleteEvent, getDayEvents,
  createNote, getNote, updateNote, deleteNote, listNotes,
  createBookmark, getBookmark, deleteBookmark, listBookmarks,
  createHabit, getHabit, listHabits, deleteHabit, checkHabit,
  logMood, getMoodEntries,
  logFinance, getFinanceEntries, deleteFinanceEntry,
  logHealth, getHealthEntries,
  createCourse, updateProgress, getCourse, listCourses, deleteCourse,
  addReading, updateReadingProgress, getReading, listReadings, deleteReading,
  createGoal, updateGoalProgress, getGoal, listGoals, deleteGoal,
  addInspiration, getInspiration, listInspirations, deleteInspiration,
  createContact, getContact, updateContact, listContacts, deleteContact,
  createProject, getProject, updateProject, listProjects, deleteProject,
  createPasswordEntry, getPasswordEntry, getPassword, listPasswordEntries, updatePasswordEntry, deletePasswordEntry, generatePassword, setEncryptionKey,
  startTimeLog, endTimeLog, getTimeLog, getActiveTimeLogs, getTimeLogs, deleteTimeLog,
} from '@colomind/assistant'
import { chat, chatStream, agentRegistry, listSkills } from '@colomind/core'
import { getSentinel } from '@colomind/sentinel'
import { charterManager, getBuiltinCharter, listBuiltinCharterTypes, getBuiltinLibrary, listBuiltinLibraries } from '@colomind/charter'

const app = new Hono()
const UID = 'default'
const PORT = parseInt(process.env.SIDECAR_PORT || '3456')

getDb()
setEncryptionKey(process.env.COLOMIND_ENCRYPTION_KEY || 'default-desktop-key')

app.use('*', cors())

// ─── Health ────────────────────────────────────────────

app.get('/api/health', (c) => c.json({ ok: true, port: PORT }))

// ─── Chat ──────────────────────────────────────────────

app.post('/api/chat/stream', async (c) => {
  const body = await c.req.json()
  return streamSSE(c, async (stream) => {
    try {
      for await (const chunk of chatStream(body.messages)) {
        await stream.writeSSE({ data: JSON.stringify({ choices: [{ delta: { content: chunk.content } }] }) })
      }
      await stream.writeSSE({ data: '[DONE]' })
    } catch (e: any) {
      await stream.writeSSE({ data: JSON.stringify({ error: e.message }) })
    }
  })
})

app.post('/api/chat', async (c) => {
  const { messages } = await c.req.json()
  return c.json(await chat(messages))
})

// ─── Sessions ──────────────────────────────────────────

const db = getDb()
db.exec(`CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, title TEXT, created_at TEXT)`)

app.get('/api/sessions', (c) => {
  const rows = db.prepare('SELECT id, title, created_at FROM sessions ORDER BY created_at DESC').all() as any[]
  return c.json(rows.map(r => ({ id: r.id, title: r.title, createdAt: r.created_at })))
})
app.post('/api/sessions', async (c) => {
  const body = await c.req.json()
  const id = body.id || `session-${Date.now()}`
  db.prepare('INSERT OR IGNORE INTO sessions (id, title, created_at) VALUES (?, ?, ?)').run(id, body.title || '新对话', new Date().toISOString())
  return c.json({ id, title: body.title || '新对话', createdAt: new Date().toISOString() })
})
app.delete('/api/sessions/:id', (c) => {
  db.prepare('DELETE FROM sessions WHERE id = ?').run(c.req.param('id'))
  return c.json({ ok: true })
})

// ─── Todos (createTodo takes input object with userId inside) ────

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

// ─── Calendar (createEvent takes input object) ─────────

app.get('/api/assistant/calendar', (c) => c.json(getDayEvents(UID, new Date().toISOString().slice(0, 10))))
app.post('/api/assistant/calendar', async (c) => c.json(createEvent({ ...(await c.req.json()), userId: UID })))
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

// ─── Learning (createCourse takes userId, name, totalHours) ──

app.get('/api/assistant/learning', (c) => c.json(listCourses(UID)))
app.post('/api/assistant/learning', async (c) => {
  const body = await c.req.json()
  return c.json(createCourse(UID, body.name, body.totalHours))
})
app.get('/api/assistant/learning/:id', (c) => c.json(getCourse(c.req.param('id'), UID)))
app.put('/api/assistant/learning/:id', async (c) => {
  const body = await c.req.json()
  if (body.completedHours !== undefined) return c.json(updateProgress(c.req.param('id'), UID, body.completedHours))
  return c.json(getCourse(c.req.param('id'), UID))
})
app.delete('/api/assistant/learning/:id', (c) => c.json(deleteCourse(c.req.param('id'), UID)))

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

// ─── Time Tracker (startTimeLog takes userId, activity, category, note) ──

app.get('/api/assistant/timetracker', (c) => c.json(getTimeLogs(UID)))
app.get('/api/assistant/timetracker/active', (c) => c.json(getActiveTimeLogs(UID)))
app.post('/api/assistant/timetracker', async (c) => {
  const body = await c.req.json()
  return c.json(startTimeLog(UID, body.activity, body.category, body.note))
})
app.put('/api/assistant/timetracker/:id', (c) => c.json(endTimeLog(c.req.param('id'), UID)))
app.delete('/api/assistant/timetracker/:id', (c) => c.json(deleteTimeLog(c.req.param('id'), UID)))

// ─── Agents ────────────────────────────────────────────

app.get('/api/agents', (c) => c.json(agentRegistry.list()))
app.post('/api/agents', async (c) => c.json(agentRegistry.create(await c.req.json())))
app.get('/api/agents/:id', (c) => c.json(agentRegistry.get(c.req.param('id'))))
app.put('/api/agents/:id', async (c) => c.json(agentRegistry.update(c.req.param('id'), await c.req.json())))
app.delete('/api/agents/:id', (c) => c.json(agentRegistry.delete(c.req.param('id'))))
app.post('/api/agents/:id/start', (c) => c.json({ ok: true, agentId: c.req.param('id') }))
app.post('/api/agents/:id/stop', (c) => c.json({ ok: true, agentId: c.req.param('id') }))

// ─── Sentinel ──────────────────────────────────────────

const sentinel = getSentinel()

app.post('/api/sentinel/scan', async (c) => {
  const body = await c.req.json()
  const result = await sentinel.fullScan(body.input || body.message, body.sessionId)
  return c.json(result)
})
app.get('/api/sentinel/status', (c) => c.json({
  layers: {
    vocabulary: { active: true, blockedCount: 0 },
    intent: { active: true, blockedCount: 0 },
    legal: { active: true, blockedCount: 0 },
  },
  heartbeats: {},
}))
app.get('/api/sentinel/logs', (c) => c.json([]))

// ─── Charter ───────────────────────────────────────────

app.get('/api/charters', (c) => {
  const builtin = listBuiltinCharterTypes().map(t => ({ id: t, name: t, type: t, builtin: true, ...getBuiltinCharter(t) }))
  return c.json(builtin)
})
app.get('/api/libraries', (c) => {
  const builtin = listBuiltinLibraries().map(n => ({ id: n, name: n, builtin: true, ...getBuiltinLibrary(n) }))
  return c.json(builtin)
})

// ─── Skills ────────────────────────────────────────────

app.get('/api/skills', async (c) => {
  try { return c.json(await listSkills()) } catch { return c.json([]) }
})

// ─── Settings ──────────────────────────────────────────

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

app.get('/api/settings', (c) => c.json(loadSettings()))
app.put('/api/settings', async (c) => {
  saveSettingsToFile(await c.req.json())
  return c.json({ ok: true })
})
app.post('/api/settings/export', (c) => c.json({ exportedAt: new Date().toISOString() }))
app.post('/api/settings/import', (c) => c.json({ imported: true }))

// ─── Start ─────────────────────────────────────────────

serve({ fetch: app.fetch, port: PORT })
console.log(`Sidecar ready on port ${PORT}`)
writeFileSync(join(tmpdir(), 'nexusmind-sidecar-port'), String(PORT))