import { writable } from 'svelte/store'

// ─── Theme ─────────────────────────────────────────────

function createThemeStore() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('theme') : null
  const store = writable<'dark' | 'light'>(stored === 'light' ? 'light' : 'dark')

  store.subscribe(v => {
    document.documentElement.setAttribute('data-theme', v)
    localStorage.setItem('theme', v)
  })

  return store
}

export const theme = createThemeStore()

// ─── Sidecar ───────────────────────────────────────────

function getSidecarPort(): number {
  const injected = (window as any).__SIDECAR_PORT__
  if (injected) return injected
  return parseInt(localStorage.getItem('sidecar_port') || '3456')
}

export const sidecarReady = writable(false)
export const sidecarPort = writable(getSidecarPort())

// Wait for sidecar to be ready
async function waitForSidecar(maxRetries = 30): Promise<number> {
  const port = getSidecarPort()

  // Check if Tauri already injected the port
  if ((window as any).__SIDECAR_READY__) {
    sidecarReady.set(true)
    return port
  }

  // Poll the health endpoint
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`)
      if (res.ok) {
        sidecarReady.set(true)
        return port
      }
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 500))
  }

  throw new Error('Sidecar not ready after timeout')
}

// ─── API helpers ───────────────────────────────────────

let _port: number = getSidecarPort()

waitForSidecar().then(p => {
  _port = p
  sidecarPort.set(p)
  sidecarReady.set(true)
}).catch(() => {
  // Fallback: try default port
  _port = 3456
  sidecarReady.set(true)
})

export async function api(path: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(`http://localhost:${_port}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API ${path}: ${res.status} ${body}`)
  }
  return res.json()
}

export async function apiStream(path: string, body: any, onChunk: (text: string) => void): Promise<void> {
  const res = await fetch(`http://localhost:${_port}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API ${path}: ${res.status}`)
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value, { stream: true })
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ') && line !== 'data: [DONE]') {
        try {
          const parsed = JSON.parse(line.slice(6))
          const content = parsed.choices?.[0]?.delta?.content
          if (content) onChunk(content)
        } catch { /* skip malformed SSE */ }
      }
    }
  }
}

// ─── Stores ────────────────────────────────────────────

export const currentRoute = writable('/')
export const sidebarCollapsed = writable(false)
export const sessions = writable<any[]>([])
export const currentSessionId = writable<string | null>(null)
export const messages = writable<{ role: string; content: string }[]>([])
export const assistantData = writable<Record<string, any>>({})
export const agents = writable<any[]>([])
export const logs = writable<any[]>([])

export async function loadLogs(level?: string, category?: string) {
  const params = new URLSearchParams()
  if (level) params.set('level', level)
  if (category) params.set('category', category)
  params.set('limit', '100')
  try { logs.set(await api(`/api/logs?${params}`)) } catch {}
}
export const sentinelLogs = writable<any[]>([])
export const charters = writable<any[]>([])
export const libraries = writable<any[]>([])
export const settings = writable<Record<string, any>>({
  openaiApiKey: '',
  anthropicApiKey: '',
  defaultModel: 'gpt-4o',
  language: 'zh-CN',
  autoStart: false,
  globalShortcut: 'Cmd+Shift+N',
})