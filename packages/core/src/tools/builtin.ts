/**
 * 内置工具集
 *
 * 包含：
 * - 文件操作：read_file, write_file, list_dir, delete_file
 * - 搜索：web_search
 * - 执行：shell (python 使用 Pyodide WASM 沙箱，见 python-pyodide.ts)
 * - 网络：http_request
 * - 数据：json_parse, csv_parse
 */

import * as fs from 'fs'
import * as path from 'path'
import type { ToolContext } from '@colomind/types'
import { toolRegistry } from './registry.js'
import { search, getSearchConfig } from '../search.js'
import { registerSubagentTools } from './subagent.js'
import { registerSearchTools } from './web-search.js'
import { registerWorkspaceTools } from './workspace.js'
import { registerExecCodeTool } from './exec-code.js'
import { registerAgentTools } from './agent-tools.js'
import { registerCreateSkillTool } from './create-skill.js'
import { registerPythonTool } from './python-pyodide.js'

// ── 文件工具 ──────────────────────────────────────────────

/**
 * 读取文件
 */
async function readFile(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const filePath = args.path as string
  if (!filePath) throw new Error('path is required')

  const absolutePath = resolvePath(filePath, ctx)

  try {
    const content = await fs.promises.readFile(absolutePath, 'utf-8')
    return content
  } catch (e: any) {
    throw new Error(`Failed to read file: ${e.message}`)
  }
}

/**
 * 写入文件
 */
async function writeFile(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const filePath = args.path as string
  const content = args.content as string
  if (!filePath) throw new Error('path is required')
  if (content === undefined) throw new Error('content is required')

  const absolutePath = resolvePath(filePath, ctx)

  try {
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true })
    await fs.promises.writeFile(absolutePath, content, 'utf-8')
    return `File written: ${filePath}`
  } catch (e: any) {
    throw new Error(`Failed to write file: ${e.message}`)
  }
}

/**
 * 列出目录
 */
async function listDir(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const dirPath = (args.path as string) || '.'
  const absolutePath = resolvePath(dirPath, ctx)

  try {
    const entries = await fs.promises.readdir(absolutePath, { withFileTypes: true })
    const result = entries.map((e) => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : 'file',
    }))
    return JSON.stringify(result, null, 2)
  } catch (e: any) {
    throw new Error(`Failed to list directory: ${e.message}`)
  }
}

/**
 * 删除文件
 */
async function deleteFile(args: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  const filePath = args.path as string
  if (!filePath) throw new Error('path is required')

  const absolutePath = resolvePath(filePath, ctx)

  try {
    await fs.promises.unlink(absolutePath)
    return `File deleted: ${filePath}`
  } catch (e: any) {
    throw new Error(`Failed to delete file: ${e.message}`)
  }
}

/**
 * 解析路径（支持相对路径）
 */
function resolvePath(filePath: string, ctx: ToolContext): string {
  if (path.isAbsolute(filePath)) {
    return filePath
  }
  const basePath = ctx.workspace || process.cwd()
  return path.resolve(basePath, filePath)
}

// ── 搜索工具 ──────────────────────────────────────────────

/**
 * 网络搜索
 */
async function webSearch(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const query = args.query as string
  if (!query) throw new Error('query is required')

  const maxResults = (args.maxResults as number) || getSearchConfig().maxResults

  try {
    const response = await search(query, { maxResults })

    const results = response.results.map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 200),
    }))

    return JSON.stringify(results, null, 2)
  } catch (e: any) {
    throw new Error(`Search failed: ${e.message}`)
  }
}

// ── 执行工具 ──────────────────────────────────────────────

/**
 * Shell 执行（受限白名单）
 */
const ALLOWED_SHELL_COMMANDS = [
  // 文件操作
  'ls',
  'dir',
  'cat',
  'head',
  'tail',
  'wc',
  'find',
  'tree',
  'mkdir',
  'touch',
  'rm',
  'cp',
  'mv',
  'chmod',
  'chown',
  // 文本处理
  'grep',
  'sed',
  'awk',
  'sort',
  'uniq',
  'cut',
  'tr',
  'diff',
  // 系统
  'echo',
  'pwd',
  'whoami',
  'date',
  'cal',
  'uptime',
  'df',
  'du',
  'ps',
  'top',
  'kill',
  'pkill',
  'pgrep',
  'env',
  'printenv',
  'which',
  'whereis',
  'type',
  // 网络（只读）
  'ping',
  'curl',
  'wget',
  'nslookup',
  'dig',
  'host',
  // Git
  'git',
  'gh',
  // 包管理（只读）
  'npm',
  'yarn',
  'pnpm',
  'pip',
  'pip3',
]

async function shellExec(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const command = args.command as string
  if (!command) throw new Error('command is required')

  const { execSync } = await import('child_process')

  // 提取命令名
  const cmdName = command.trim().split(/\s+/)[0]

  // 检查是否在白名单中
  const isAllowed = ALLOWED_SHELL_COMMANDS.some(
    (allowed) => cmdName === allowed || cmdName.endsWith('/' + allowed),
  )

  if (!isAllowed) {
    return `Error: Command '${cmdName}' is not allowed. Allowed commands: ${ALLOWED_SHELL_COMMANDS.join(', ')}`
  }

  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
      cwd: process.cwd(),
    })
    return result || '(no output)'
  } catch (e: any) {
    // 超时
    if (e.signal === 'SIGKILL') {
      return `Error: Command timed out (30s)`
    }
    return e.stderr || e.stdout || `Error: ${e.message}`
  }
}

// ── 网络工具 ──────────────────────────────────────────────

/**
 * HTTP 请求
 */
async function httpRequest(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const url = args.url as string
  const method = ((args.method as string) || 'GET').toUpperCase()
  const headers = (args.headers as Record<string, string>) || {}
  const body = args.body as string | undefined

  if (!url) throw new Error('url is required')

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })

    const contentType = response.headers.get('content-type') || ''
    let data: any

    if (contentType.includes('application/json')) {
      data = await response.json()
    } else {
      data = await response.text()
    }

    return JSON.stringify(
      {
        status: response.status,
        ok: response.ok,
        data,
      },
      null,
      2,
    )
  } catch (e: any) {
    throw new Error(`HTTP request failed: ${e.message}`)
  }
}

// ── 数据工具 ──────────────────────────────────────────────

/**
 * JSON 解析
 */
async function jsonParse(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const text = args.text as string
  if (!text) throw new Error('text is required')

  try {
    const data = JSON.parse(text)
    return JSON.stringify(data, null, 2)
  } catch (e: any) {
    throw new Error(`JSON parse failed: ${e.message}`)
  }
}

/**
 * CSV 解析
 */
async function csvParse(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const text = args.text as string
  const delimiter = (args.delimiter as string) || ','
  if (!text) throw new Error('text is required')

  const lines = text.trim().split('\n')
  if (lines.length === 0) return '[]'

  const headers = lines[0].split(delimiter).map((h) => h.trim())
  const rows = lines.slice(1).map((line) => {
    const values = line.split(delimiter).map((v) => v.trim())
    const row: Record<string, string> = {}
    headers.forEach((h, i) => {
      row[h] = values[i] || ''
    })
    return row
  })

  return JSON.stringify(rows, null, 2)
}

// ── 数学工具 ──────────────────────────────────────────────

/**
 * 数学计算
 */
async function calculate(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const expression = args.expression as string
  if (!expression) throw new Error('expression is required')

  // 安全的数学表达式计算
  const safeEval = (expr: string): number => {
    // 只允许数字、运算符、括号、数学函数
    const allowed = /^[\d\s+\-*/().^%Math,sin,cos,tan,sqrt,abs,log,exp,pow,floor,ceil,round,PI,E]+$/
    if (!allowed.test(expr)) {
      throw new Error('Invalid expression')
    }
    // 使用 Function 构造器安全执行
    return new Function(`"use strict"; return (${expr})`)()
  }

  try {
    const result = safeEval(expression)
    return String(result)
  } catch (e: any) {
    throw new Error(`Calculation failed: ${e.message}`)
  }
}

// ── 注册所有工具 ──────────────────────────────────────────────

export function registerBuiltinTools(): void {
  // 文件工具
  toolRegistry.register({
    name: 'read_file',
    description: 'Read file content',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
    execute: readFile,
  })

  toolRegistry.register({
    name: 'write_file',
    description: 'Write content to file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
        content: { type: 'string', description: 'File content' },
      },
      required: ['path', 'content'],
    },
    execute: writeFile,
  })

  toolRegistry.register({
    name: 'list_dir',
    description: 'List directory contents',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (default: current)' },
      },
      required: [],
    },
    execute: listDir,
  })

  toolRegistry.register({
    name: 'delete_file',
    description: 'Delete a file',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'File path' },
      },
      required: ['path'],
    },
    execute: deleteFile,
  })

  // 搜索工具
  toolRegistry.register({
    name: 'web_search',
    description: 'Search the web',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        maxResults: { type: 'number', description: 'Max results (default: 10)' },
      },
      required: ['query'],
    },
    execute: webSearch,
  })

  // 执行工具 - 使用 Pyodide WASM 沙箱
  registerPythonTool()

  toolRegistry.register({
    name: 'shell',
    description:
      'Execute shell command (restricted to allowed commands: ls, cat, grep, git, npm, etc.)',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Shell command (must be in allowed list)' },
      },
      required: ['command'],
    },
    execute: shellExec,
  })

  // 网络工具
  toolRegistry.register({
    name: 'http',
    description: 'Make HTTP request',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Request URL' },
        method: { type: 'string', description: 'HTTP method (GET, POST, etc.)' },
        headers: { type: 'object', description: 'Request headers' },
        body: { type: 'object', description: 'Request body' },
      },
      required: ['url'],
    },
    execute: httpRequest,
  })

  // 数据工具
  toolRegistry.register({
    name: 'json_parse',
    description: 'Parse JSON string',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'JSON text' },
      },
      required: ['text'],
    },
    execute: jsonParse,
  })

  toolRegistry.register({
    name: 'csv_parse',
    description: 'Parse CSV string',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'CSV text' },
        delimiter: { type: 'string', description: 'Delimiter (default: ,)' },
      },
      required: ['text'],
    },
    execute: csvParse,
  })

  // 数学工具
  toolRegistry.register({
    name: 'calculate',
    description: 'Calculate mathematical expression',
    parameters: {
      type: 'object',
      properties: {
        expression: { type: 'string', description: 'Math expression' },
      },
      required: ['expression'],
    },
    execute: calculate,
  })

  // 测试工具
  toolRegistry.register({
    name: 'echo',
    description: 'Echo back the input message',
    parameters: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message to echo' },
      },
      required: ['message'],
    },
    execute: async (args) => (args.message as string) || '',
  })

  // 位置工具
  toolRegistry.register({
    name: 'get_location',
    description: 'Get current location by IP geolocation',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    execute: get_location,
  })
}

/**
 * 获取当前位置（通过 IP 定位或系统 GPS）
 */
async function get_location(_args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  // 优先尝试系统 GPS
  const systemLocation = await getSystemLocation()
  if (systemLocation) {
    return systemLocation
  }

  // 回退到 IP 定位
  try {
    // 方法1: pconline IP 定位（中国准确）
    const pconline = await fetch('https://whois.pconline.com.cn/ipJson.jsp?json=true')
    if (pconline.ok) {
      const text = await pconline.text()
      // 提取 JSON 部分（跳过空行）
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const data = JSON.parse(jsonMatch[0])
        if (data.cityCode) {
          // 联网获取城市名
          let cityName = data.cityCode
          try {
            const geoRes = await fetch(
              `https://geo.datav.aliyun.com/areas_v3/bound/${data.cityCode}.json`,
            )
            if (geoRes.ok) {
              const geoData = (await geoRes.json()) as any
              if (geoData.features?.[0]?.properties?.name) {
                cityName = geoData.features[0].properties.name
              }
            }
          } catch {
            // 忽略错误，使用 cityCode
          }
          return JSON.stringify(
            {
              province: data.proCode,
              city: cityName,
              cityCode: data.cityCode,
              ip: data.ip,
              isp: data.addr,
              source: 'PConline IP',
            },
            null,
            2,
          )
        }
      }
    }

    // 方法2: 使用 ip-api.com
    const fallback = await fetch('http://ip-api.com/json/?lang=zh-CN')
    if (fallback.ok) {
      const data = (await fallback.json()) as any
      if (data.status === 'success') {
        return JSON.stringify(
          {
            country: data.country,
            province: data.regionName,
            city: data.city,
            lat: data.lat,
            lon: data.lon,
            isp: data.isp,
            source: 'IP-API',
          },
          null,
          2,
        )
      }
    }

    return 'Unable to determine location'
  } catch (error) {
    return `Location error: ${error instanceof Error ? error.message : String(error)}`
  }
}

/**
 * 获取系统 GPS 位置
 */
async function getSystemLocation(): Promise<string | null> {
  const platform = process.platform

  try {
    if (platform === 'darwin') {
      // macOS: 使用 CoreLocation
      return await getMacOSLocation()
    } else if (platform === 'linux') {
      // Linux: 使用 geoclue
      return await getLinuxLocation()
    }
  } catch (error) {
    // 系统定位失败，回退到 IP 定位
  }

  return null
}

/**
 * macOS CoreLocation 定位
 */
async function getMacOSLocation(): Promise<string | null> {
  const { execSync } = await import('child_process')

  // 方法1: 尝试 whereami 工具（需要安装：brew install whereami）
  try {
    const result = execSync('whereami', {
      encoding: 'utf-8',
      timeout: 5000,
    })
    const parts = result.trim().split(',')
    if (parts.length >= 2) {
      const lat = parseFloat(parts[0])
      const lon = parseFloat(parts[1])
      if (!isNaN(lat) && !isNaN(lon)) {
        return JSON.stringify(
          {
            lat,
            lon,
            source: 'GPS (whereami)',
          },
          null,
          2,
        )
      }
    }
  } catch {
    // whereami not installed
  }

  // 方法2: 尝试 CoreLocation (需要授权)
  const swiftCode = `
import Foundation
import CoreLocation

if !CLLocationManager.locationServicesEnabled() {
  exit(1)
}

let manager = CLLocationManager()
let status = manager.authorizationStatus

if status == .denied || status == .restricted {
  exit(1)
}

let semaphore = DispatchSemaphore(value: 0)
var lat: Double = 0
var lon: Double = 0
var acc: Double = 0
var success = false

class Delegate: NSObject, CLLocationManagerDelegate {
  let done: () -> Void
  init(done: @escaping () -> Void) { self.done = done }

  func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
    if let loc = locations.first {
      lat = loc.coordinate.latitude
      lon = loc.coordinate.longitude
      acc = loc.horizontalAccuracy
      success = true
      manager.stopUpdatingLocation()
      done()
    }
  }

  func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
    manager.stopUpdatingLocation()
    done()
  }
}

let delegate = Delegate { semaphore.signal() }
manager.delegate = delegate
manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
manager.startUpdatingLocation()

if semaphore.wait(timeout: .now() + 8) == .success && success {
  print(String(format: "%.6f,%.6f,%.1f", lat, lon, acc))
}
`

  try {
    const result = execSync(`swift -e '${swiftCode.replace(/'/g, "'\"'\"'")}'`, {
      encoding: 'utf-8',
      timeout: 12000,
    })

    const output = result.trim()
    if (output && output.includes(',')) {
      const [latStr, lonStr, accStr] = output.split(',')
      const lat = parseFloat(latStr)
      const lon = parseFloat(lonStr)
      const accuracy = parseFloat(accStr)
      if (!isNaN(lat) && !isNaN(lon)) {
        return JSON.stringify(
          {
            lat,
            lon,
            accuracy,
            source: 'GPS (CoreLocation)',
          },
          null,
          2,
        )
      }
    }
  } catch {
    // CoreLocation failed
  }

  return null
}

/**
 * Linux geoclue 定位
 */
async function getLinuxLocation(): Promise<string | null> {
  const { execSync } = await import('child_process')

  // 方法1: 尝试 geoclue-2.0 D-Bus API
  try {
    // 先检查 geoclue 是否可用
    execSync('busctl --user status org.freedesktop.GeoClue2 2>/dev/null', { timeout: 2000 })

    // 获取当前位置
    const result = execSync(
      `
busctl call --user org.freedesktop.GeoClue2 /org/freedesktop/GeoClue2/Client \
  org.freedesktop.GeoClue2.Client Start 2>/dev/null
sleep 3
busctl get-property --user org.freedesktop.GeoClue2 /org/freedesktop/GeoClue2/Client \
  org.freedesktop.GeoClue2.Client Location 2>/dev/null
`,
      {
        encoding: 'utf-8',
        timeout: 10000,
      },
    )

    if (result.includes('o')) {
      // 解析位置对象路径，然后获取坐标
      // 简化处理，实际需要完整 D-Bus 调用
    }
  } catch {
    // geoclue not available
  }

  // 方法2: 尝试读取 /sys/class/net/*/address + IP 定位
  // (已在主函数中作为回退)

  // 方法3: 尝试 hostname 获取位置信息（某些系统配置）
  try {
    const hostname = execSync('hostname', { encoding: 'utf-8' }).trim()
    // 可以根据主机名推断位置（需要用户配置）
  } catch {
    // ignore
  }

  return null
}

// 导出所有工具注册函数
export { toolRegistry, tool } from './registry.js'
export { registerSearchTools } from './web-search.js'
export { registerWorkspaceTools } from './workspace.js'
export { registerExecCodeTool } from './exec-code.js'
export { registerSubagentTools } from './subagent.js'
export { registerAgentTools } from './agent-tools.js'
export { registerCreateSkillTool } from './create-skill.js'

/**
 * 注册所有工具
 */
export function registerAllTools(): void {
  registerBuiltinTools()
  registerSubagentTools()
  // registerSearchTools() - 已在 registerBuiltinTools() 中注册 web_search
  registerWorkspaceTools()
  registerExecCodeTool()
  registerAgentTools()
  registerCreateSkillTool()
}
