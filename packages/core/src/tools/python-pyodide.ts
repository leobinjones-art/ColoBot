/**
 * Pyodide Python 执行器 - WASM 沙箱环境
 *
 * 使用 Pyodide 在 Node.js 中运行 Python，无需系统 Python 依赖
 */

import type { ToolContext } from '@colobot/types'
import { toolRegistry } from './registry.js'

// Pyodide 类型定义
interface PyodideInterface {
  runPythonAsync: (code: string) => Promise<unknown>
  loadPackage: (packages: string | string[]) => Promise<unknown>
  runPython: (code: string) => unknown
  globals: {
    get: (name: string) => unknown
    set: (name: string, value: unknown) => void
  }
  FS: {
    writeFile: (path: string, data: string | Uint8Array) => void
    readFile: (path: string, options?: { encoding: string }) => string | Uint8Array
    mkdir: (path: string) => void
    rmdir: (path: string) => void
    unlink: (path: string) => void
    readdir: (path: string) => string[]
  }
  setStdout: (options: { batched: (text: string) => void }) => void
  setStderr: (options: { batched: (text: string) => void }) => void
}

/**
 * Python 沙箱配置
 */
interface PythonSandboxConfig {
  timeout: number // 执行超时（毫秒）
  maxOutputSize: number // 最大输出字节数
  allowedModules: string[] // 允许的模块白名单
  preloadPackages: string[] // 预加载的包
}

const DEFAULT_SANDBOX_CONFIG: PythonSandboxConfig = {
  timeout: 30000,
  maxOutputSize: 10 * 1024 * 1024,
  allowedModules: [
    // 标准库安全模块
    'math',
    'random',
    'statistics',
    'decimal',
    'fractions',
    'datetime',
    'time',
    'calendar',
    'json',
    'csv',
    're',
    'string',
    'collections',
    'itertools',
    'functools',
    'operator',
    'typing',
    'dataclasses',
    'enum',
    'copy',
    'pprint',
    'textwrap',
    'hashlib',
    'hmac',
    'secrets',
    'base64',
    'binascii',
    'struct',
    'io',
    'pathlib',
    'urllib.parse',
    'uuid',
  ],
  preloadPackages: ['numpy', 'pandas'],
}

/**
 * Pyodide 运行时管理器
 */
class PyodideRuntime {
  private pyodide: PyodideInterface | null = null
  private loadingPromise: Promise<PyodideInterface> | null = null
  private config: PythonSandboxConfig

  constructor(config: Partial<PythonSandboxConfig> = {}) {
    this.config = { ...DEFAULT_SANDBOX_CONFIG, ...config }
  }

  /**
   * 获取或初始化 Pyodide 实例
   */
  async getInstance(): Promise<PyodideInterface> {
    if (this.pyodide) {
      return this.pyodide
    }

    if (this.loadingPromise) {
      return this.loadingPromise
    }

    this.loadingPromise = this.loadPyodide()
    this.pyodide = await this.loadingPromise
    return this.pyodide
  }

  /**
   * 加载 Pyodide
   */
  private async loadPyodide(): Promise<PyodideInterface> {
    // 动态加载 pyodide
    const { loadPyodide } = await import('pyodide')

    const pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/',
    })

    // 预加载常用包
    if (this.config.preloadPackages.length > 0) {
      try {
        await pyodide.loadPackage(this.config.preloadPackages)
      } catch {
        // 预加载失败不影响基本功能
      }
    }

    return pyodide as unknown as PyodideInterface
  }

  /**
   * 执行 Python 代码
   */
  async runCode(code: string): Promise<{ output: string; error: string | null }> {
    const pyodide = await this.getInstance()
    const output: string[] = []
    const errors: string[] = []

    // 设置 stdout/stderr 捕获
    pyodide.setStdout({
      batched: (text: string) => {
        output.push(text)
      },
    })

    pyodide.setStderr({
      batched: (text: string) => {
        errors.push(text)
      },
    })

    try {
      // 执行代码（带超时）
      const result = await this.runWithTimeout(pyodide.runPythonAsync(code), this.config.timeout)

      // 处理返回值
      if (result !== undefined && result !== null) {
        output.push(String(result))
      }

      // 检查输出大小
      const fullOutput = output.join('\n')
      if (fullOutput.length > this.config.maxOutputSize) {
        return {
          output: fullOutput.slice(0, this.config.maxOutputSize) + '\n... (output truncated)',
          error: null,
        }
      }

      return { output: fullOutput || '(no output)', error: null }
    } catch (e: any) {
      const errorMsg = e.message || String(e)
      return { output: '', error: errorMsg }
    }
  }

  /**
   * 带超时的 Promise 执行
   */
  private async runWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timed out after ${timeout}ms`))
      }, timeout)

      promise
        .then((result) => {
          clearTimeout(timer)
          resolve(result)
        })
        .catch((error) => {
          clearTimeout(timer)
          reject(error)
        })
    })
  }

  /**
   * 安装额外的包
   */
  async installPackage(packageName: string): Promise<void> {
    const pyodide = await this.getInstance()
    await pyodide.loadPackage(packageName)
  }

  /**
   * 重置运行时（清除所有变量）
   */
  async reset(): Promise<void> {
    if (!this.pyodide) return

    // 清除用户定义的变量
    await this.pyodide.runPythonAsync(`
import sys
for name in list(globals().keys()):
    if not name.startswith('_') and name not in ['sys', 'builtins']:
        del globals()[name]
    `)
  }

  /**
   * 销毁运行时
   */
  destroy(): void {
    this.pyodide = null
    this.loadingPromise = null
  }
}

// 全局运行时实例
let globalRuntime: PyodideRuntime | null = null

/**
 * 获取全局 Pyodide 运行时
 */
function getRuntime(config?: Partial<PythonSandboxConfig>): PyodideRuntime {
  if (!globalRuntime) {
    globalRuntime = new PyodideRuntime(config)
  }
  return globalRuntime
}

/**
 * Python 执行工具
 */
async function pythonExec(args: Record<string, unknown>, _ctx: ToolContext): Promise<string> {
  const code = args.code as string
  if (!code) throw new Error('code is required')

  const config: Partial<PythonSandboxConfig> = {}

  if (args.timeout) config.timeout = Math.min(args.timeout as number, 60000)
  if (args.packages) config.preloadPackages = args.packages as string[]

  const runtime = getRuntime(config)
  const { output, error } = await runtime.runCode(code)

  if (error) {
    return JSON.stringify({ ok: false, error, output })
  }

  return JSON.stringify({ ok: true, output })
}

/**
 * 注册 Python 执行工具
 */
export function registerPythonTool(): void {
  toolRegistry.register({
    name: 'python',
    description: 'Execute Python code in a WASM sandbox (Pyodide). No system Python required.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'Python code to execute',
        },
        timeout: {
          type: 'number',
          description: 'Execution timeout in milliseconds (default: 30000, max: 60000)',
        },
        packages: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional packages to load (e.g., ["numpy", "pandas", "matplotlib"])',
        },
      },
      required: ['code'],
    },
    execute: pythonExec,
  })
}

// 导出运行时类供高级用法
export { PyodideRuntime, getRuntime }
export type { PythonSandboxConfig }
