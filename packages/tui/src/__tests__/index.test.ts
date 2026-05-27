/**
 * @colomind/tui 测试
 * 使用可写流捕获输出（替代 vi.spyOn）
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { Writable } from 'node:stream'

// 可写流捕获（替代 vi.spyOn(process.stdout, 'write')）
function createOutputCapture() {
  const chunks: string[] = []
  const stream = new Writable({
    write(chunk: Buffer, _encoding: string, callback: () => void) {
      chunks.push(chunk.toString())
      callback()
    },
  })
  return {
    stream,
    getOutput: () => chunks.join(''),
    getChunks: () => [...chunks],
    clear: () => { chunks.length = 0 },
  }
}

// console 输出捕获（替代 vi.spyOn(console, 'log')）
function createConsoleCapture() {
  const logs: string[] = []
  const errors: string[] = []
  const originalLog = console.log
  const originalError = console.error
  const originalClear = console.clear

  const capture = {
    logs,
    errors,
    clearCalled: false,
    logCount: () => logs.length,
    errorCount: () => errors.length,
    wasLogCalled: () => logs.length > 0,
    wasErrorCalled: () => errors.length > 0,
    wasClearCalled: () => capture.clearCalled,
    restore: () => {
      console.log = originalLog
      console.error = originalError
      console.clear = originalClear
    },
  }

  console.log = (...args: any[]) => {
    logs.push(args.map(a => typeof a === 'string' ? a : String(a)).join(' '))
  }
  console.error = (...args: any[]) => {
    errors.push(args.map(a => typeof a === 'string' ? a : String(a)).join(' '))
  }
  console.clear = () => {
    capture.clearCalled = true
  }

  return capture
}

describe('@colomind/tui', () => {
  let consoleCapture: ReturnType<typeof createConsoleCapture>

  beforeEach(() => {
    consoleCapture = createConsoleCapture()
  })

  describe('style and colors', () => {
    it('should style text', async () => {
      const { style, colors } = await import('../render/index.js')

      const styled = style('hello', 'red', 'bold')
      expect(styled).toContain('hello')
      expect(styled).toContain(colors.red)
      expect(styled).toContain(colors.bold)
    })

    it('should have color codes', async () => {
      const { colors } = await import('../render/index.js')

      expect(colors.red).toBeDefined()
      expect(colors.green).toBeDefined()
      expect(colors.blue).toBeDefined()
      expect(colors.reset).toBeDefined()
    })

    it('should create progress bar', async () => {
      const { progressBar } = await import('../render/index.js')

      const bar = progressBar(50, 100)
      expect(bar).toContain('50%')
    })

    it('should create progress bar with custom width', async () => {
      const { progressBar } = await import('../render/index.js')

      const bar = progressBar(75, 100, 20)
      expect(bar).toContain('75%')
    })

    it('should print title', async () => {
      const { printTitle } = await import('../render/index.js')

      printTitle('Test Title')
      expect(consoleCapture.wasLogCalled()).toBe(true)

      consoleCapture.restore()
    })

    it('should print divider', async () => {
      const { printDivider } = await import('../render/index.js')

      printDivider('-', 40)
      expect(consoleCapture.wasLogCalled()).toBe(true)

      consoleCapture.restore()
    })

    it('should print message', async () => {
      const { printMessage } = await import('../render/index.js')

      printMessage('user', 'Hello')
      expect(consoleCapture.wasLogCalled()).toBe(true)

      consoleCapture.restore()
    })

    it('should print error', async () => {
      const { printError } = await import('../render/index.js')

      printError('Test error')
      expect(consoleCapture.wasErrorCalled()).toBe(true)

      consoleCapture.restore()
    })

    it('should print success', async () => {
      const { printSuccess } = await import('../render/index.js')

      printSuccess('Test success')
      expect(consoleCapture.wasLogCalled()).toBe(true)

      consoleCapture.restore()
    })

    it('should print warning', async () => {
      const { printWarning } = await import('../render/index.js')

      printWarning('Test warning')
      expect(consoleCapture.wasLogCalled()).toBe(true)

      consoleCapture.restore()
    })

    it('should print table', async () => {
      const { printTable } = await import('../render/index.js')

      printTable(
        ['Name', 'Value'],
        [
          ['Item1', '100'],
          ['Item2', '200'],
        ],
      )
      expect(consoleCapture.wasLogCalled()).toBe(true)

      consoleCapture.restore()
    })
  })

  describe('ChatUI', () => {
    it('should create chat UI', async () => {
      const { ChatUI } = await import('../components/index.js')

      const chat = new ChatUI('Test Chat')
      expect(chat).toBeDefined()
    })

    it('should add messages', async () => {
      const { ChatUI } = await import('../components/index.js')

      const chat = new ChatUI('Test Chat')
      chat.addMessage('user', 'Hello')
      chat.addMessage('assistant', 'Hi there')

      expect(consoleCapture.wasLogCalled()).toBe(true)

      consoleCapture.restore()
    })

    it('should show typing indicator', async () => {
      const { ChatUI } = await import('../components/index.js')

      const output = createOutputCapture()
      // 临时替换 stdout.write
      const originalWrite = process.stdout.write
      process.stdout.write = output.stream.write.bind(output.stream)

      const chat = new ChatUI()
      chat.showTyping()

      expect(output.getChunks().length).toBeGreaterThan(0)

      process.stdout.write = originalWrite
    })

    it('should hide typing indicator', async () => {
      const { ChatUI } = await import('../components/index.js')

      const output = createOutputCapture()
      const originalWrite = process.stdout.write
      process.stdout.write = output.stream.write.bind(output.stream)

      const chat = new ChatUI()
      chat.hideTyping()

      expect(output.getChunks().length).toBeGreaterThan(0)

      process.stdout.write = originalWrite
    })

    it('should clear history', async () => {
      const { ChatUI } = await import('../components/index.js')

      const chat = new ChatUI()
      chat.clear()

      expect(consoleCapture.wasClearCalled()).toBe(true)

      consoleCapture.restore()
    })
  })

  describe('CommandPalette', () => {
    it('should create command palette', async () => {
      const { CommandPalette } = await import('../components/index.js')

      const commands = new CommandPalette()
      expect(commands).toBeDefined()
      expect(commands.list()).toHaveLength(0)
    })

    it('should register command', async () => {
      const { CommandPalette } = await import('../components/index.js')

      const commands = new CommandPalette()
      let handlerCalled = false
      const handler = () => { handlerCalled = true }

      commands.register('/test', 'Test command', handler)
      expect(commands.list()).toContain('/test')
    })

    it('should execute command', async () => {
      const { CommandPalette } = await import('../components/index.js')

      let handlerCalled = false
      const commands = new CommandPalette()
      const handler = () => { handlerCalled = true }

      commands.register('/test', 'Test command', handler)
      const result = commands.execute('/test')

      expect(result).toBe(true)
      expect(handlerCalled).toBe(true)
    })

    it('should return false for unknown command', async () => {
      const { CommandPalette } = await import('../components/index.js')

      const commands = new CommandPalette()
      const result = commands.execute('/unknown')

      expect(result).toBe(false)
    })

    it('should show help', async () => {
      const { CommandPalette } = await import('../components/index.js')

      const commands = new CommandPalette()
      commands.register('/test', 'Test command', () => {})
      commands.showHelp()

      expect(consoleCapture.wasLogCalled()).toBe(true)

      consoleCapture.restore()
    })
  })

  describe('StatusBar', () => {
    it('should create status bar', async () => {
      const { StatusBar } = await import('../components/index.js')

      const status = new StatusBar()
      expect(status).toBeDefined()
    })

    it('should update status', async () => {
      const { StatusBar } = await import('../components/index.js')

      const output = createOutputCapture()
      const originalWrite = process.stdout.write
      process.stdout.write = output.stream.write.bind(output.stream)

      const status = new StatusBar()
      status.update('Processing', 'step 1')

      expect(output.getChunks().length).toBeGreaterThan(0)

      process.stdout.write = originalWrite
    })

    it('should clear status', async () => {
      const { StatusBar } = await import('../components/index.js')

      const output = createOutputCapture()
      const originalWrite = process.stdout.write
      process.stdout.write = output.stream.write.bind(output.stream)

      const status = new StatusBar()
      status.clear()

      expect(output.getChunks().length).toBeGreaterThan(0)

      process.stdout.write = originalWrite
    })
  })

  describe('LogPanel', () => {
    it('should create log panel', async () => {
      const { LogPanel } = await import('../components/index.js')

      const logs = new LogPanel()
      expect(logs).toBeDefined()
    })

    it('should add logs', async () => {
      const { LogPanel } = await import('../components/index.js')

      const logs = new LogPanel()
      logs.log('info', 'test message')

      const allLogs = logs.getLogs()
      expect(allLogs).toHaveLength(1)
      expect(allLogs[0].level).toBe('info')
      expect(allLogs[0].message).toBe('test message')

      consoleCapture.restore()
    })

    it('should limit max logs', async () => {
      const { LogPanel } = await import('../components/index.js')

      const logs = new LogPanel()

      for (let i = 0; i < 150; i++) {
        logs.log('info', `message ${i}`)
      }

      const allLogs = logs.getLogs()
      expect(allLogs.length).toBeLessThanOrEqual(100)

      consoleCapture.restore()
    })

    it('should add different log levels', async () => {
      const { LogPanel } = await import('../components/index.js')

      const logs = new LogPanel()
      logs.log('warn', 'warning message')
      logs.log('error', 'error message')
      logs.log('debug', 'debug message')

      const allLogs = logs.getLogs()
      expect(allLogs).toHaveLength(3)

      consoleCapture.restore()
    })
  })

  describe('TUI', () => {
    it('should create TUI instance', async () => {
      const { TUI } = await import('../index.js')

      const tui = new TUI()
      expect(tui).toBeDefined()
      expect(tui.chat).toBeDefined()
      expect(tui.commands).toBeDefined()
      expect(tui.status).toBeDefined()
      expect(tui.logs).toBeDefined()
    })

    it('should have default commands', async () => {
      const { TUI } = await import('../index.js')

      const tui = new TUI()
      const commands = tui.commands.list()

      expect(commands).toContain('/help')
      expect(commands).toContain('/clear')
    })

    it('should start TUI', async () => {
      const { TUI } = await import('../index.js')

      const tui = new TUI()
      await tui.start('Test')

      expect(consoleCapture.wasClearCalled()).toBe(true)
      expect(consoleCapture.wasLogCalled()).toBe(true)

      consoleCapture.restore()
    })
  })
})