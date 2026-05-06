/**
 * ColoBot 消费者版服务器入口
 *
 * 特点：
 * - 首次启动显示配置向导
 * - 配置保存到本地文件
 * - 内置 SQLite 数据库
 */

import http from 'http'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import {
  isConfigured,
  loadConfig,
  saveConfig,
  completeOnboarding,
  healthCheck,
  livenessCheck,
  initHealthChecker,
  createGracefulShutdown,
  Logger,
} from '@colobot/core'

const logger = new Logger({ prefix: 'server' })
const PORT = parseInt(process.env.PORT || '3000')
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 前端静态文件目录
const FRONTEND_DIR = path.join(__dirname, '../frontend/dist')

/**
 * 创建 HTTP 服务器
 */
function createServer() {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${PORT}`)

    // CORS 头
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // API 路由
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url)
      return
    }

    // 健康检查
    if (url.pathname === '/health') {
      const health = await healthCheck()
      res.writeHead(health.status === 'healthy' ? 200 : 503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(health))
      return
    }

    // 存活检查
    if (url.pathname === '/healthz') {
      const live = livenessCheck()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(live))
      return
    }

    // 静态文件服务
    serveStatic(req, res, url)
  })

  return server
}

/**
 * 处理 API 请求
 */
async function handleApi(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  url: URL
) {
  const pathname = url.pathname

  // GET /api/config - 获取当前配置状态
  if (req.method === 'GET' && pathname === '/api/config') {
    const configured = isConfigured()
    const config = loadConfig()

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      configured,
      language: config.language,
      careLevel: config.careLevel,
      ai: {
        provider: config.ai.provider,
        hasKey: config.ai.apiKey.length > 0,
      },
    }))
    return
  }

  // POST /api/config - 保存配置（配置向导调用）
  if (req.method === 'POST' && pathname === '/api/config') {
    const body = await readBody(req)

    try {
      const data = JSON.parse(body)
      const config = completeOnboarding({
        provider: data.provider || 'openai',
        apiKey: data.apiKey || '',
        language: data.language || 'zh-CN',
        careLevel: data.careLevel || 'greet',
        adminPassword: data.adminPassword,
      })

      console.log('✓ Configuration saved')

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: true,
        message: 'Configuration saved',
      }))
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }))
    }
    return
  }

  // POST /api/config/test - 测试 API Key
  if (req.method === 'POST' && pathname === '/api/config/test') {
    const body = await readBody(req)

    try {
      const data = JSON.parse(body)
      // TODO: 实际测试 API Key
      const valid = data.apiKey && data.apiKey.length > 10

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        success: valid,
        message: valid ? 'API Key is valid' : 'Invalid API Key',
      }))
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: 'Test failed' }))
    }
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
}

/**
 * 读取请求体
 */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => resolve(body))
    req.on('error', reject)
  })
}

/**
 * 静态文件服务
 */
function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
  let filePath = url.pathname

  // 默认 index.html
  if (filePath === '/') {
    filePath = '/index.html'
  }

  const fullPath = path.join(FRONTEND_DIR, filePath)

  // 检查文件是否存在
  if (!fs.existsSync(fullPath)) {
    // SPA 回退到 index.html
    if (fs.existsSync(path.join(FRONTEND_DIR, 'index.html'))) {
      serveFile(res, path.join(FRONTEND_DIR, 'index.html'))
    } else {
      // 前端未构建，显示提示
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>ColoBot</title>
          <style>
            body { font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
            .container { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #333; margin-bottom: 16px; }
            p { color: #666; }
            code { background: #eee; padding: 2px 6px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🤖 ColoBot</h1>
            <p>服务已启动</p>
            <p>API 端点: <code>/api/config</code></p>
            <p>健康检查: <code>/health</code></p>
          </div>
        </body>
        </html>
      `)
    }
    return
  }

  serveFile(res, fullPath)
}

/**
 * 提供文件
 */
function serveFile(res: http.ServerResponse, filePath: string) {
  const ext = path.extname(filePath).toLowerCase()
  const contentTypes: Record<string, string> = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
  }

  const contentType = contentTypes[ext] || 'application/octet-stream'

  try {
    const content = fs.readFileSync(filePath)
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(content)
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain' })
    res.end('Internal Server Error')
  }
}

/**
 * 主函数
 */
function main() {
  const configured = isConfigured()

  console.log('')
  console.log('╔════════════════════════════════════════════╗')
  console.log('║            ColoBot Consumer Edition         ║')
  console.log('╠════════════════════════════════════════════╣')

  if (!configured) {
    console.log('║  ⚠️  首次启动，请完成配置                    ║')
    console.log('║  打开浏览器访问: http://localhost:' + PORT.toString().padEnd(4) + '     ║')
  } else {
    console.log('║  ✓ 配置已完成                               ║')
    console.log('║  访问地址: http://localhost:' + PORT.toString().padEnd(4) + '             ║')
  }

  console.log('╚════════════════════════════════════════════╝')
  console.log('')

  // 初始化健康检查
  initHealthChecker({
    version: '0.4.0',
  })

  // 启动服务器
  const server = createServer()
  server.listen(PORT, () => {
    logger.info(`Server running on http://localhost:${PORT}`)
  })

  // 优雅关闭
  createGracefulShutdown({
    server,
    timeout: 30000,
    cleanup: async () => {
      logger.info('Cleaning up resources...')
      // 这里可以添加数据库关闭等清理逻辑
    },
    onShutdown: () => {
      logger.info('Server stopped gracefully')
    },
    onSignal: (signal) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`)
    },
  })
}

main()
