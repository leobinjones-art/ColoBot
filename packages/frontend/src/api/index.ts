import axios from 'axios'
import { handleAuthFailure, updateTokenFromHeader } from '@/utils/auth'

const isDev = import.meta.env.DEV

// 生产环境：API 和前端同源，直接使用相对路径
// 开发环境：代理到本地 Mock 服务器
export const http = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
})

http.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

http.interceptors.response.use(
  (res) => {
    updateTokenFromHeader(res.headers as Record<string, string>)
    const data = res.data
    if (data && typeof data === 'object' && 'code' in data) {
      if (data.code === 200) return data
      if (data.code === 401) {
        handleAuthFailure()
        return Promise.reject(new Error(data.msg || 'Unauthorized'))
      }
      return Promise.reject(new Error(data.msg || 'Request failed'))
    }
    return data
  },
  (err) => {
    if (err.response?.status === 401) {
      handleAuthFailure()
    }
    return Promise.reject(err.response?.data?.msg || err.message)
  }
)

// ==================== Auth ====================
export const authApi = {
  login: (data: { username: string; password: string }) =>
    http.post('/auth/login', data),
  logout: () => http.post('/auth/logout'),
  me: () => http.get('/auth/me'),
}

// ==================== Agent ====================
export const agentApi = {
  list: () => http.get('/agents'),
  get: (id: string | number) => http.get(`/agents/${id}`),
  create: (data: any) => http.post('/agents', data),
  update: (id: string | number, data: any) => http.put(`/agents/${id}`, data),
  delete: (id: string | number) => http.delete(`/agents/${id}`),
  chat: (id: string | number, data: any) => http.post(`/agents/${id}/chat`, data),
}

// ==================== Chat ====================
export const chatApi = {
  stream: (data: any, signal?: AbortSignal) => {
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    }
    const token = localStorage.getItem('token')
    if (token) headers.Authorization = `Bearer ${token}`
    return fetch('/api/v1/chat/stream', {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
      signal,
    })
  },
  stop: (conversationId: string) =>
    http.post(`/chat/${conversationId}/stop`),
}

// ==================== Conversation ====================
export const conversationApi = {
  list: () => http.get('/conversations'),
  listMessages: (conversationId: string) =>
    http.get(`/conversations/${conversationId}/messages`),
  delete: (conversationId: string) =>
    http.delete(`/conversations/${conversationId}`),
  rename: (conversationId: string, title: string) =>
    http.put(`/conversations/${conversationId}/title`, { title }),
}

// ==================== Skill ====================
export const skillApi = {
  page: (params: any = {}) => http.get('/skills', { params }),
  get: (id: string | number) => http.get(`/skills/${id}`),
  create: (data: any) => http.post('/skills', data),
  update: (id: string | number, data: any) => http.put(`/skills/${id}`, data),
  delete: (id: string | number) => http.delete(`/skills/${id}`),
  toggle: (id: string | number, enabled: boolean) =>
    http.put(`/skills/${id}/toggle?enabled=${enabled}`),
}

// ==================== Sentinel ====================
export const sentinelApi = {
  status: () => http.get('/sentinel/status'),
  sessions: () => http.get('/sentinel/sessions'),
  scanInput: (message: string, sessionId?: string) =>
    http.post('/sentinel/scan/input', { message, sessionId }),
  scanOutput: (response: string) =>
    http.post('/sentinel/scan/output', { response }),
}

// ==================== Todo ====================
export const todoApi = {
  list: () => http.get('/todos'),
  get: (id: string | number) => http.get(`/todos/${id}`),
  create: (data: any) => http.post('/todos', data),
  update: (id: string | number, data: any) => http.put(`/todos/${id}`, data),
  delete: (id: string | number) => http.delete(`/todos/${id}`),
  complete: (id: string | number) => http.post(`/todos/${id}/complete`),
  today: () => http.get('/todos/today'),
}

// ==================== Reminder ====================
export const reminderApi = {
  list: () => http.get('/reminders'),
  create: (data: any) => http.post('/reminders', data),
  delete: (id: string | number) => http.delete(`/reminders/${id}`),
  complete: (id: string | number) => http.post(`/reminders/${id}/complete`),
}

// ==================== Event ====================
export const eventApi = {
  list: (params?: { start?: string; end?: string }) =>
    http.get('/events', { params }),
  create: (data: any) => http.post('/events', data),
  update: (id: string | number, data: any) => http.put(`/events/${id}`, data),
  delete: (id: string | number) => http.delete(`/events/${id}`),
  day: (date: string) => http.get(`/events/day?date=${date}`),
  week: () => http.get('/events/week'),
}

// ==================== Note ====================
export const noteApi = {
  list: () => http.get('/notes'),
  get: (id: string | number) => http.get(`/notes/${id}`),
  create: (data: any) => http.post('/notes', data),
  update: (id: string | number, data: any) => http.put(`/notes/${id}`, data),
  delete: (id: string | number) => http.delete(`/notes/${id}`),
  search: (q: string) => http.get(`/notes/search?q=${encodeURIComponent(q)}`),
}

// ==================== Habit ====================
export const habitApi = {
  list: () => http.get('/habits'),
  create: (data: any) => http.post('/habits', data),
  delete: (id: string | number) => http.delete(`/habits/${id}`),
  check: (id: string | number) => http.post(`/habits/${id}/check`),
  logs: (id: string | number) => http.get(`/habits/${id}/logs`),
}

// ==================== Mood ====================
export const moodApi = {
  list: (params?: { limit?: number }) => http.get('/moods', { params }),
  create: (data: any) => http.post('/moods', data),
  stats: () => http.get('/moods/stats'),
}

// ==================== Finance ====================
export const financeApi = {
  list: (params?: { start?: string; end?: string }) =>
    http.get('/finances', { params }),
  create: (data: any) => http.post('/finances', data),
  stats: () => http.get('/finances/stats'),
  monthly: () => http.get('/finances/monthly'),
}

// ==================== Goal ====================
export const goalApi = {
  list: () => http.get('/goals'),
  create: (data: any) => http.post('/goals', data),
  delete: (id: string | number) => http.delete(`/goals/${id}`),
  progress: (id: string | number, progress: number) =>
    http.put(`/goals/${id}/progress`, { progress }),
}

// ==================== Contact ====================
export const contactApi = {
  list: () => http.get('/contacts'),
  create: (data: any) => http.post('/contacts', data),
  update: (id: string | number, data: any) => http.put(`/contacts/${id}`, data),
  delete: (id: string | number) => http.delete(`/contacts/${id}`),
  search: (q: string) => http.get(`/contacts/search?q=${encodeURIComponent(q)}`),
}

// ==================== Intent ====================
export const intentApi = {
  parse: (text: string) => http.post('/intent/parse', { text }),
}

// ==================== Config ====================
export const configApi = {
  get: () => http.get('/config'),
  update: (data: any) => http.put('/config', data),
  models: () => http.get('/config/models'),
  status: () => http.get('/config/status'),
  clearCache: () => http.post('/config/clear-cache'),
  reset: () => http.post('/config/reset'),
  export: () => http.get('/config/export'),
}

// ==================== Charter ====================
export const charterApi = {
  list: () => http.get('/charters'),
  active: () => http.get('/charters/active'),
  apply: (data: { type: string; reason: string; sessionId?: string }) =>
    http.post('/charters/apply', data),
  revoke: (instanceId: string) => http.post(`/charters/${instanceId}/revoke`),
  checkCapability: (capability: string) =>
    http.get(`/charters/check?capability=${capability}`),
  definitions: () => http.get('/charters/definitions'),
}

// ==================== User Profile ====================
export const userProfileApi = {
  get: () => http.get('/user/profile'),
  memories: () => http.get('/user/memories'),
  deleteMemory: (id: string) => http.delete(`/user/memories/${id}`),
  exportData: () => http.get('/user/export'),
  clearData: () => http.post('/user/clear'),
}

// ==================== Security Log ====================
export const securityLogApi = {
  list: (params?: { start?: string; end?: string }) =>
    http.get('/security/logs', { params }),
  stats: () => http.get('/security/logs/stats'),
}

// ==================== Behavior Settings ====================
export const behaviorApi = {
  get: () => http.get('/behavior'),
  update: (data: any) => http.put('/behavior', data),
}