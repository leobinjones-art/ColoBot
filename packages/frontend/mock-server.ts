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
  {
    id: '1',
    name: 'General Assistant',
    agentType: 'chat',
    description: '通用对话助手',
    enabled: true,
    icon: '🤖',
  },
  {
    id: '2',
    name: 'Code Helper',
    agentType: 'code',
    description: '代码助手',
    enabled: true,
    icon: '💻',
  },
]

const mockTodos = [
  {
    id: '1',
    title: '完成前端开发',
    description: 'Vue 3 + TypeScript',
    priority: 'high',
    status: 'doing',
    dueDate: '2026-05-05',
    tags: ['work'],
  },
  {
    id: '2',
    title: '部署到服务器',
    description: 'Linux 部署',
    priority: 'medium',
    status: 'done',
    dueDate: '2026-05-02',
    tags: ['devops'],
  },
]

const mockReminders = [
  {
    id: '1',
    title: '周会',
    content: '每周一上午10点',
    remindAt: '2026-05-05T10:00:00',
    repeat: 'weekly',
    status: 'pending',
  },
]

const mockEvents = [
  {
    id: '1',
    title: '项目评审',
    description: '前端项目评审',
    startAt: '2026-05-05T14:00:00',
    endAt: '2026-05-05T16:00:00',
    location: '会议室A',
  },
]

const mockNotes = [
  {
    id: '1',
    title: '开发笔记',
    content: 'Vue 3 组合式 API 使用记录',
    tags: ['dev', 'vue'],
    createdAt: '2026-05-01',
    updatedAt: '2026-05-01',
  },
]

const mockContacts = [
  {
    id: '1',
    name: '张三',
    organization: 'Tech Corp',
    role: 'Engineer',
    email: 'zhangsan@example.com',
    tags: ['work'],
  },
]

const mockGoals = [
  {
    id: '1',
    title: '学习 TypeScript',
    description: '掌握 TypeScript 高级特性',
    targetDate: '2026-06-01',
    progress: 60,
    status: 'active',
  },
]

const mockHabits = [
  { id: '1', name: '早起', icon: '🌅', frequency: 'daily', streak: 7 },
  { id: '2', name: '运动', icon: '🏃', frequency: 'daily', streak: 3 },
]

const mockMoods = [
  { id: '1', mood: 'happy', score: 8, note: '今天心情不错', loggedAt: '2026-05-01T20:00:00' },
]

const mockFinances = [
  {
    id: '1',
    type: 'expense',
    amount: 35.5,
    category: '餐饮',
    note: '午餐',
    loggedAt: '2026-05-02T12:00:00',
  },
  {
    id: '2',
    type: 'income',
    amount: 10000,
    category: '工资',
    note: '4月工资',
    loggedAt: '2026-05-01T10:00:00',
  },
]

// Auth API
const ADMIN_USER = 'admin'
const ADMIN_PASS = 'colobot2024'

app.post('/api/v1/auth/login', (req, res) => {
  const { username, password } = req.body
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    res.json({ code: 200, data: { token: 'mock-token-' + Date.now() } })
  } else {
    res.status(401).json({ code: 401, msg: '用户名或密码错误' })
  }
})

app.get('/api/v1/auth/me', (req, res) => {
  const token = req.headers.authorization
  if (token) {
    res.json({ code: 200, data: { id: '1', username: 'admin', role: 'admin' } })
  } else {
    res.status(401).json({ code: 401, msg: '未授权' })
  }
})

app.post('/api/v1/auth/logout', (req, res) => {
  res.json({ code: 200, success: true })
})

// Agent API
app.get('/api/v1/agents', (req, res) => res.json({ code: 200, data: mockAgents }))
app.post('/api/v1/agents', (req, res) =>
  res.json({ code: 200, data: { id: Date.now().toString(), ...req.body } }),
)
app.patch('/api/v1/agents/:id', (req, res) => res.json({ code: 200, success: true }))
app.put('/api/v1/agents/:id', (req, res) => res.json({ code: 200, success: true }))
app.delete('/api/v1/agents/:id', (req, res) => res.json({ code: 200, success: true }))

// Todo API
app.get('/api/v1/todos', (req, res) => res.json({ code: 200, data: mockTodos }))
app.post('/api/v1/todos', (req, res) =>
  res.json({ code: 200, data: { id: Date.now().toString(), ...req.body, status: 'pending' } }),
)
app.put('/api/v1/todos/:id', (req, res) => res.json({ code: 200, success: true }))
app.patch('/api/v1/todos/:id', (req, res) => res.json({ code: 200, success: true }))
app.delete('/api/v1/todos/:id', (req, res) => res.json({ code: 200, success: true }))
app.post('/api/v1/todos/:id/complete', (req, res) => res.json({ code: 200, success: true }))

// Reminder API
app.get('/api/v1/reminders', (req, res) => res.json({ code: 200, data: mockReminders }))
app.post('/api/v1/reminders', (req, res) =>
  res.json({ code: 200, data: { id: Date.now().toString(), ...req.body, status: 'pending' } }),
)
app.delete('/api/v1/reminders/:id', (req, res) => res.json({ code: 200, success: true }))
app.post('/api/v1/reminders/:id/complete', (req, res) => res.json({ code: 200, success: true }))

// Event API
app.get('/api/v1/events', (req, res) => res.json({ code: 200, data: mockEvents }))
app.post('/api/v1/events', (req, res) =>
  res.json({ code: 200, data: { id: Date.now().toString(), ...req.body } }),
)
app.put('/api/v1/events/:id', (req, res) => res.json({ code: 200, success: true }))
app.delete('/api/v1/events/:id', (req, res) => res.json({ code: 200, success: true }))

// Note API
app.get('/api/v1/notes', (req, res) => res.json({ code: 200, data: mockNotes }))
app.get('/api/v1/notes/search', (req, res) => res.json({ code: 200, data: mockNotes }))
app.post('/api/v1/notes', (req, res) =>
  res.json({
    code: 200,
    data: {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }),
)
app.put('/api/v1/notes/:id', (req, res) => res.json({ code: 200, success: true }))
app.delete('/api/v1/notes/:id', (req, res) => res.json({ code: 200, success: true }))

// Contact API
app.get('/api/v1/contacts', (req, res) => res.json({ code: 200, data: mockContacts }))
app.get('/api/v1/contacts/search', (req, res) => res.json({ code: 200, data: mockContacts }))
app.post('/api/v1/contacts', (req, res) =>
  res.json({ code: 200, data: { id: Date.now().toString(), ...req.body } }),
)
app.put('/api/v1/contacts/:id', (req, res) => res.json({ code: 200, success: true }))
app.delete('/api/v1/contacts/:id', (req, res) => res.json({ code: 200, success: true }))

// Skill API
const mockSkills = [
  {
    id: '1',
    name: 'morning_brief',
    nameZh: '每天早上提醒我今天要做什么',
    icon: '🌅',
    enabled: true,
    description: '',
  },
  {
    id: '2',
    name: 'mood_check',
    nameZh: '我心情不好时关心我',
    icon: '💝',
    enabled: true,
    description: '',
  },
  {
    id: '3',
    name: 'weekly_review',
    nameZh: '每周日帮我总结这周做了什么',
    icon: '📊',
    enabled: false,
    description: '',
  },
  {
    id: '4',
    name: 'habit_reminder',
    nameZh: '到时间提醒我打卡习惯',
    icon: '🎯',
    enabled: true,
    description: '',
  },
  {
    id: '5',
    name: 'translate',
    nameZh: '帮我翻译外语',
    icon: '🌐',
    enabled: true,
    description: '',
  },
]
app.get('/api/v1/skills', (req, res) => res.json({ code: 200, data: { records: mockSkills } }))
app.put('/api/v1/skills/:id/toggle', (req, res) => res.json({ code: 200, success: true }))

// Goal API
app.get('/api/v1/goals', (req, res) => res.json({ code: 200, data: mockGoals }))
app.post('/api/v1/goals', (req, res) =>
  res.json({ code: 200, data: { id: Date.now().toString(), ...req.body, status: 'active' } }),
)
app.delete('/api/v1/goals/:id', (req, res) => res.json({ code: 200, success: true }))
app.put('/api/v1/goals/:id/progress', (req, res) => res.json({ code: 200, success: true }))

// Habit API
app.get('/api/v1/habits', (req, res) => res.json({ code: 200, data: mockHabits }))
app.post('/api/v1/habits', (req, res) =>
  res.json({ code: 200, data: { id: Date.now().toString(), ...req.body, streak: 0 } }),
)
app.delete('/api/v1/habits/:id', (req, res) => res.json({ code: 200, success: true }))
app.post('/api/v1/habits/:id/check', (req, res) => res.json({ code: 200, success: true }))
app.get('/api/v1/habits/:id/logs', (req, res) => res.json({ code: 200, data: [] }))

// Mood API
app.get('/api/v1/moods', (req, res) => res.json({ code: 200, data: mockMoods }))
app.post('/api/v1/moods', (req, res) =>
  res.json({
    code: 200,
    data: { id: Date.now().toString(), ...req.body, loggedAt: new Date().toISOString() },
  }),
)
app.get('/api/v1/moods/stats', (req, res) =>
  res.json({ code: 200, data: { average: 7, count: 10 } }),
)

// Finance API
app.get('/api/v1/finances', (req, res) => res.json({ code: 200, data: mockFinances }))
app.post('/api/v1/finances', (req, res) =>
  res.json({
    code: 200,
    data: { id: Date.now().toString(), ...req.body, loggedAt: new Date().toISOString() },
  }),
)
app.get('/api/v1/finances/stats', (req, res) =>
  res.json({ code: 200, data: { totalIncome: 10000, totalExpense: 35.5 } }),
)
app.get('/api/v1/finances/monthly', (req, res) => res.json({ code: 200, data: [] }))

// Config API
app.get('/api/v1/config', (req, res) =>
  res.json({ code: 200, data: { storage: {}, logging: { level: 'info' }, features: {} } }),
)
app.put('/api/v1/config', (req, res) => res.json({ code: 200, success: true }))
app.get('/api/v1/config/status', (req, res) =>
  res.json({
    code: 200,
    data: { server: 'running', database: 'connected', vectorStore: 'ready', version: '0.2.1' },
  }),
)
app.post('/api/v1/config/clear-cache', (req, res) => res.json({ code: 200, success: true }))
app.post('/api/v1/config/reset', (req, res) => res.json({ code: 200, success: true }))
app.get('/api/v1/config/export', (req, res) =>
  res.json({ code: 200, data: { config: {}, exportedAt: new Date().toISOString() } }),
)
app.get('/api/v1/config/models', (req, res) =>
  res.json({
    code: 200,
    data: [
      {
        id: 'openai',
        name: 'OpenAI',
        type: 'openai',
        models: [{ id: 'gpt-4o', name: 'GPT-4o', enabled: true }],
        enabled: true,
        isLocal: false,
      },
      {
        id: 'ollama',
        name: 'Ollama',
        type: 'ollama',
        models: [{ id: 'llama3', name: 'Llama 3', enabled: true }],
        enabled: true,
        isLocal: true,
      },
    ],
  }),
)

// User Profile API
app.get('/api/v1/user/profile', (req, res) =>
  res.json({
    code: 200,
    data: {
      userId: 'user',
      profileVersion: '1.0.0',
      generatedAt: new Date().toISOString(),
      psychological: {
        overallScore: 75,
        status: 'good',
        dominantMood: 'happy',
        trend: 'stable',
        streakDays: 7,
        riskLevel: 'none',
        insights: ['心理状态良好，继续保持积极的生活态度'],
      },
      lifestyle: {
        habitCount: 2,
        activeHabits: 2,
        bestStreak: 7,
        checkInRate: 100,
        consistency: 'high',
        insights: ['习惯坚持度很高，自律能力优秀'],
      },
      productivity: {
        totalTodos: 2,
        completionRate: 50,
        overdueCount: 0,
        highPriorityPending: 1,
        insights: ['任务完成率良好，可以尝试优化优先级管理'],
      },
      social: {
        totalContacts: 1,
        recentInteractions: 0,
        relationshipHealth: 'inactive',
        insights: ['最近社交活动较少，可以主动联系朋友'],
      },
      financial: {
        totalIncome: 10000,
        totalExpense: 35.5,
        balance: 9964.5,
        savingsRate: 99,
        insights: ['储蓄率99%，财务状况良好'],
      },
      health: {
        healthScore: 65,
        exerciseFrequency: 1,
        insights: ['运动频率较低，建议每周至少运动3次'],
      },
      growth: {
        activeGoals: 1,
        completedGoals: 0,
        averageProgress: 60,
        nearDeadlineGoals: 0,
        insights: ['目标进度良好，保持动力'],
      },
      aiContext: `## 用户画像 (user)

### 心理状态
- 整体评分：75/100 (good)
- 趋势：stable
- 主导情绪：happy

### 生活习惯
- 习惯数量：2
- 活跃习惯：2
- 最长连续：7天
- 打卡率：100%

### 工作效率
- 任务总数：2
- 完成率：50%
- 逾期任务：0

### 社交关系
- 联系人：1
- 近期互动：0
- 社交活跃度：inactive

### 财务状况
- 收入：10000
- 支出：35.5
- 储蓄率：99%

### 健康状况
- 健康分数：65/100
- 本周运动：1次

### 关键洞察
- 心理状态良好，继续保持积极的生活态度
- 习惯坚持度很高，自律能力优秀
- 储蓄率99%，财务状况良好`,
    },
  }),
)

// Sentinel API
app.get('/api/v1/sentinel/status', (req, res) =>
  res.json({
    code: 200,
    data: {
      status: 'healthy',
      lastCheck: new Date().toISOString(),
      agentsMonitored: 2,
      activeSessions: 1,
      recentTakeovers: 0,
    },
  }),
)

app.get('/api/v1/sentinel/sessions', (req, res) =>
  res.json({
    code: 200,
    data: [
      {
        sessionId: 'sess-001',
        agentId: 'agent-1',
        status: 'active',
        lastHeartbeat: new Date().toISOString(),
        currentPhase: 'streaming',
      },
    ],
  }),
)

app.post('/api/v1/sentinel/scan/input', (req, res) => {
  const { message } = req.body
  const hasRisk = message.includes('密码') || message.includes('token') || message.includes('key')
  res.json({
    code: 200,
    data: {
      safe: !hasRisk,
      issues: hasRisk ? ['检测到敏感信息'] : [],
    },
  })
})

app.post('/api/v1/sentinel/scan/output', (req, res) => {
  const { response } = req.body
  const hasRisk = response.includes('error') || response.includes('失败')
  res.json({
    code: 200,
    data: {
      safe: !hasRisk,
      issues: hasRisk ? ['输出包含错误信息'] : [],
    },
  })
})

// User Memories API
app.get('/api/v1/user/memories', (req, res) =>
  res.json({
    code: 200,
    data: [
      { id: '1', content: '你是程序员，主要用 TypeScript', createdAt: '2026-05-01T10:00:00' },
      { id: '2', content: '最近在做一个叫 ColoBot 的项目', createdAt: '2026-05-02T14:00:00' },
      { id: '3', content: '每天大概 11 点睡觉', createdAt: '2026-05-02T20:00:00' },
    ],
  }),
)

app.delete('/api/v1/user/memories/:id', (req, res) => res.json({ code: 200, success: true }))

app.get('/api/v1/user/export', (req, res) =>
  res.json({
    code: 200,
    data: {
      memories: [],
      moods: [],
      habits: [],
      todos: [],
      exportedAt: new Date().toISOString(),
    },
  }),
)

app.post('/api/v1/user/clear', (req, res) => res.json({ code: 200, success: true }))

// Security Logs API
app.get('/api/v1/security/logs', (req, res) =>
  res.json({
    code: 200,
    data: [
      { id: '1', time: '10:23', type: 'input', status: 'passed', message: '输入审核通过' },
      { id: '2', time: '10:24', type: 'output', status: 'passed', message: '输出审核通过' },
      {
        id: '3',
        time: '10:25',
        type: 'output',
        status: 'intercepted',
        message: '输出包含敏感词"密码"，已替换',
      },
    ],
  }),
)

app.get('/api/v1/security/logs/stats', (req, res) =>
  res.json({
    code: 200,
    data: {
      inputTotal: 45,
      inputPassed: 45,
      outputTotal: 45,
      outputPassed: 43,
      outputIntercepted: 2,
      interceptReasons: { sensitiveWord: 1, tooLong: 1 },
    },
  }),
)

// Behavior Settings API
app.get('/api/v1/behavior', (req, res) =>
  res.json({
    code: 200,
    data: {
      style: 'normal',
      proactivity: 'greet',
      memory: 'important',
      canSeeMood: true,
      canSeeFinance: false,
      canSeeHealth: false,
      mentalHealth: {
        watchMood: true,
        proactiveCare: true,
        suggestContact: false,
        triggerDays: 7,
        threshold: 4,
      },
      safetyMode: 'normal',
    },
  }),
)

app.put('/api/v1/behavior', (req, res) => res.json({ code: 200, success: true }))

// Chat API (SSE)
app.post('/api/v1/chat/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const { message } = req.body

  // 模拟思考阶段
  res.write(`data: ${JSON.stringify({ type: 'phase', phase: 'thinking' })}\n\n`)

  setTimeout(() => {
    // 模拟工具调用
    if (message.includes('搜索') || message.includes('查询')) {
      res.write(
        `data: ${JSON.stringify({ type: 'tool_call_started', tool_name: 'web_search', arguments: JSON.stringify({ query: message }) })}\n\n`,
      )

      setTimeout(() => {
        res.write(
          `data: ${JSON.stringify({ type: 'tool_call_completed', result: '找到 3 个相关结果' })}\n\n`,
        )

        // 流式输出
        res.write(`data: ${JSON.stringify({ type: 'phase', phase: 'streaming' })}\n\n`)

        const response = `根据搜索结果，我找到了以下信息：\n\n1. 第一条相关结果\n2. 第二条相关结果\n3. 第三条相关结果\n\n希望这些信息对您有帮助！`

        let i = 0
        const interval = setInterval(() => {
          if (i < response.length) {
            const chunk = response.slice(i, i + 5)
            res.write(`data: ${JSON.stringify({ type: 'content_delta', content: chunk })}\n\n`)
            i += 5
          } else {
            clearInterval(interval)
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
            res.end()
          }
        }, 50)
      }, 1000)
    } else {
      // 普通回复
      res.write(`data: ${JSON.stringify({ type: 'phase', phase: 'streaming' })}\n\n`)

      const response = `收到消息: "${message}"\n\n这是一个模拟响应。实际部署需要连接到 ColoBot Core 后端。`

      let i = 0
      const interval = setInterval(() => {
        if (i < response.length) {
          const chunk = response.slice(i, i + 5)
          res.write(`data: ${JSON.stringify({ type: 'content_delta', content: chunk })}\n\n`)
          i += 5
        } else {
          clearInterval(interval)
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`)
          res.end()
        }
      }, 50)
    }
  }, 500)
})

app.listen(PORT, () => console.log(`Mock API server running on port ${PORT}`))
