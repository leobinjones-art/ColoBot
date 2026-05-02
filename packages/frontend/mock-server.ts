import express from 'express'
import cors from 'cors'
import { config } from 'dotenv'
config()

const app = express()
app.use(cors())
app.use(express.json())

const PORT = process.env.API_PORT || 3000

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }))

// Mock data
const mockAgents = [
  { id: '1', name: 'General Assistant', agentType: 'chat', description: '通用对话助手', enabled: true, icon: '🤖' },
  { id: '2', name: 'Code Helper', agentType: 'code', description: '代码助手', enabled: true, icon: '💻' },
]

const mockTodos = [
  { id: '1', title: '完成前端开发', description: 'Vue 3 + TypeScript', priority: 'high', status: 'doing', dueDate: '2026-05-05', tags: ['work'] },
  { id: '2', title: '部署到服务器', description: 'Linux 部署', priority: 'medium', status: 'done', dueDate: '2026-05-02', tags: ['devops'] },
]

const mockReminders = [
  { id: '1', title: '周会', content: '每周一上午10点', remindAt: '2026-05-05T10:00:00', repeat: 'weekly', status: 'pending' },
]

const mockEvents = [
  { id: '1', title: '项目评审', description: '前端项目评审', startAt: '2026-05-05T14:00:00', endAt: '2026-05-05T16:00:00', location: '会议室A' },
]

const mockNotes = [
  { id: '1', title: '开发笔记', content: 'Vue 3 组合式 API 使用记录', tags: ['dev', 'vue'], createdAt: '2026-05-01' },
]

const mockContacts = [
  { id: '1', name: '张三', organization: 'Tech Corp', role: 'Engineer', email: 'zhangsan@example.com', tags: ['work'] },
]

const mockGoals = [
  { id: '1', title: '学习 TypeScript', description: '掌握 TypeScript 高级特性', targetDate: '2026-06-01', progress: 60, status: 'active' },
]

// Auth API
const ADMIN_USER = 'admin'
const ADMIN_PASS = 'colobot2024'

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ data: { token: 'mock-token-' + Date.now() } })
  } else {
    res.status(401).json({ error: '用户名或密码错误' })
  }
})

app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization
  if (token) {
    res.json({ data: { valid: true } })
  } else {
    res.status(401).json({ error: '未授权' })
  }
})

// Agent API
app.get('/api/agents', (req, res) => res.json({ data: mockAgents }))
app.patch('/api/agents/:id', (req, res) => res.json({ success: true }))

// Todo API
app.get('/api/todos', (req, res) => res.json({ data: mockTodos }))
app.post('/api/todos', (req, res) => res.json({ success: true, data: { id: Date.now().toString(), ...req.body } }))
app.patch('/api/todos/:id', (req, res) => res.json({ success: true }))

// Reminder API
app.get('/api/reminders', (req, res) => res.json({ data: mockReminders }))
app.post('/api/reminders', (req, res) => res.json({ success: true, data: { id: Date.now().toString(), ...req.body } }))

// Event API
app.get('/api/events', (req, res) => res.json({ data: mockEvents }))
app.post('/api/events', (req, res) => res.json({ success: true, data: { id: Date.now().toString(), ...req.body } }))

// Note API
app.get('/api/notes', (req, res) => res.json({ data: mockNotes }))
app.post('/api/notes', (req, res) => res.json({ success: true, data: { id: Date.now().toString(), ...req.body } }))

// Contact API
app.get('/api/contacts', (req, res) => res.json({ data: mockContacts }))
app.post('/api/contacts', (req, res) => res.json({ success: true, data: { id: Date.now().toString(), ...req.body } }))

// Goal API
app.get('/api/goals', (req, res) => res.json({ data: mockGoals }))
app.post('/api/goals', (req, res) => res.json({ success: true, data: { id: Date.now().toString(), ...req.body } }))

// Config API
app.get('/api/config', (req, res) => res.json({ data: { storage: {}, logging: { level: 'info' }, features: {} } }))
app.patch('/api/config', (req, res) => res.json({ success: true }))

// Models API
app.get('/api/models', (req, res) => res.json({
  data: [
    { id: 'openai', name: 'OpenAI', type: 'openai', models: [{ id: 'gpt-4o', name: 'GPT-4o', enabled: true }], enabled: true, isLocal: false },
    { id: 'ollama', name: 'Ollama', type: 'ollama', models: [{ id: 'llama3', name: 'Llama 3', enabled: true }], enabled: true, isLocal: true },
  ]
}))

// Chat API (SSE)
app.post('/api/chat', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const { message } = req.body
  const response = `收到消息: "${message}"\n\n这是一个模拟响应。实际部署需要连接到 ColoBot Core 后端。`

  res.write(`data: ${JSON.stringify({ type: 'text', content: response })}\n\n`)
  res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
  res.end()
})

app.listen(PORT, () => console.log(`Mock API server running on port ${PORT}`))