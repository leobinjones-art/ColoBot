import * as os from 'os'
import { execSync } from 'child_process'
import type { ToolContext } from '@colomind/types'
import { toolRegistry } from './registry.js'

async function systemInfo(_args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const cpus = os.cpus()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem

  let diskInfo = ''
  try {
    diskInfo = execSync('df -h / 2>/dev/null | tail -1', { encoding: 'utf-8', timeout: 3000 }).trim()
  } catch { diskInfo = 'N/A' }

  let uptimeStr = ''
  const secs = os.uptime()
  const days = Math.floor(secs / 86400)
  const hours = Math.floor((secs % 86400) / 3600)
  const mins = Math.floor((secs % 3600) / 60)
  if (days > 0) uptimeStr += `${days}天 `
  uptimeStr += `${hours}小时${mins}分钟`

  let loadAvg = ''
  try { loadAvg = os.loadavg().map(l => l.toFixed(2)).join(', ') } catch { loadAvg = 'N/A' }

  return JSON.stringify({
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    osRelease: os.release(),
    cpu: { model: cpus[0]?.model || 'N/A', cores: cpus.length, speed: cpus[0]?.speed ? `${cpus[0].speed} MHz` : 'N/A' },
    memory: { total: formatBytes(totalMem), used: formatBytes(usedMem), free: formatBytes(freeMem), usagePercent: ((usedMem / totalMem) * 100).toFixed(1) + '%' },
    disk: diskInfo,
    uptime: uptimeStr,
    loadAvg,
    nodeVersion: process.version,
    pid: process.pid,
    cwd: process.cwd(),
  }, null, 2)
}

async function sentinelStatus(_args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  try {
    const res = await fetch('http://localhost:3456/api/sentinel/status')
    const data = await res.json()
    return JSON.stringify(data, null, 2)
  } catch (e: any) {
    return JSON.stringify({ error: 'Sentinel API 不可用', message: e.message })
  }
}

async function sentinelStats(_args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  try {
    const res = await fetch('http://localhost:3456/api/sentinel/stats')
    const data = await res.json()
    return JSON.stringify(data, null, 2)
  } catch (e: any) {
    return JSON.stringify({ error: 'Sentinel Stats API 不可用', message: e.message })
  }
}

async function healthCheck(_args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const checks: Record<string, any> = {}

  // Sidecar health
  try {
    const res = await fetch('http://localhost:3456/healthz')
    checks.sidecar = res.ok ? { status: 'ok', ...await res.json() } : { status: 'error', code: res.status }
  } catch { checks.sidecar = { status: 'down' } }

  // Sentinel
  try {
    const res = await fetch('http://localhost:3456/api/sentinel/status')
    const data = await res.json()
    checks.sentinel = data.active ? { status: 'ok', layers: Object.keys(data.layers || {}) } : { status: 'inactive' }
  } catch { checks.sentinel = { status: 'down' } }

  // Charter
  try {
    const res = await fetch('http://localhost:3456/api/charter/status')
    const data = await res.json()
    checks.charter = (data.initialized || data.guard) ? { status: 'ok' } : { status: 'inactive' }
  } catch { checks.charter = { status: 'down' } }

  // LLM Pool
  try {
    const res = await fetch('http://localhost:3456/api/llm/providers')
    const providers = await res.json()
    checks.llmPool = { status: 'ok', providers: providers.length, default: providers.find((p: any) => p.isDefault)?.id }
  } catch { checks.llmPool = { status: 'down' } }

  // Search
  try {
    const res = await fetch('http://localhost:3456/api/search/test')
    checks.search = res.ok ? { status: 'ok' } : { status: 'error' }
  } catch { checks.search = { status: 'unavailable' } }

  const allOk = Object.values(checks).every((c: any) => c.status === 'ok')
  checks.overall = allOk ? 'ALL_OK' : 'DEGRADED'

  return JSON.stringify(checks, null, 2)
}

async function listProcesses(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const filter = (args.filter as string) || ''
  try {
    let cmd = 'ps aux'
    if (filter) cmd += ` | grep -i "${filter}" | grep -v grep`
    const result = execSync(cmd, { encoding: 'utf-8', timeout: 5000, maxBuffer: 1024 * 1024 })
    return result.trim() || 'No matching processes'
  } catch (e: any) {
    return e.stdout || `Error: ${e.message}`
  }
}

async function networkInfo(_args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const nets = os.networkInterfaces()
  const result: Record<string, any[]> = {}
  for (const [name, addrs] of Object.entries(nets)) {
    if (!addrs) continue
    result[name] = addrs
      .filter(a => !a.internal)
      .map(a => ({ address: a.address, family: a.family, netmask: a.netmask }))
  }

  let publicIp = 'N/A'
  try {
    const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) })
    if (res.ok) publicIp = (await res.json() as any).ip
  } catch { /* ignore */ }

  return JSON.stringify({ interfaces: result, publicIp }, null, 2)
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`
}

export function registerSystemTools(): void {
  toolRegistry.register({
    name: 'system_info',
    description: '获取当前电脑/系统信息：CPU、内存、磁盘、运行时间、负载等',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: systemInfo,
  })

  toolRegistry.register({
    name: 'sentinel_status',
    description: '查询 Sentinel 安全守护系统状态：三层防御是否激活、各层详情',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: sentinelStatus,
  })

  toolRegistry.register({
    name: 'sentinel_stats',
    description: '查询 Sentinel 安全统计：输入/输出扫描次数、拦截次数、最近事件',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: sentinelStats,
  })

  toolRegistry.register({
    name: 'health_check',
    description: '系统全面自检：Sidecar、Sentinel、Charter、LLM Pool、搜索等各模块健康状态',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: healthCheck,
  })

  toolRegistry.register({
    name: 'list_processes',
    description: '列出系统进程（可按关键词过滤）',
    parameters: {
      type: 'object',
      properties: { filter: { type: 'string', description: '过滤关键词（可选）' } },
      required: [],
    },
    execute: listProcesses,
  })

  toolRegistry.register({
    name: 'network_info',
    description: '获取网络信息：网卡地址、公网IP',
    parameters: { type: 'object', properties: {}, required: [] },
    execute: networkInfo,
  })
}
