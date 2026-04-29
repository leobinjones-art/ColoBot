/**
 * @colobot/tui 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

describe('@colobot/tui', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

      // Mock console.log
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      printTitle('Test Title')
      expect(logSpy).toHaveBeenCalled()

      logSpy.mockRestore()
    })

    it('should print divider', async () => {
      const { printDivider } = await import('../render/index.js')

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      printDivider('-', 40)
      expect(logSpy).toHaveBeenCalled()

      logSpy.mockRestore()
    })

    it('should print message', async () => {
      const { printMessage } = await import('../render/index.js')

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      printMessage('user', 'Hello')
      expect(logSpy).toHaveBeenCalled()

      logSpy.mockRestore()
    })

    it('should print error', async () => {
      const { printError } = await import('../render/index.js')

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      printError('Test error')
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })

    it('should print success', async () => {
      const { printSuccess } = await import('../render/index.js')

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      printSuccess('Test success')
      expect(logSpy).toHaveBeenCalled()

      logSpy.mockRestore()
    })

    it('should print warning', async () => {
      const { printWarning } = await import('../render/index.js')

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      printWarning('Test warning')
      expect(logSpy).toHaveBeenCalled()

      logSpy.mockRestore()
    })

    it('should print table', async () => {
      const { printTable } = await import('../render/index.js')

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      printTable(['Name', 'Value'], [['Item1', '100'], ['Item2', '200']])
      expect(logSpy).toHaveBeenCalled()

      logSpy.mockRestore()
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

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const chat = new ChatUI('Test Chat')
      chat.addMessage('user', 'Hello')
      chat.addMessage('assistant', 'Hi there')

      expect(logSpy).toHaveBeenCalled()

      logSpy.mockRestore()
    })

    it('should show typing indicator', async () => {
      const { ChatUI } = await import('../components/index.js')

      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      const chat = new ChatUI()
      chat.showTyping()

      expect(writeSpy).toHaveBeenCalled()

      writeSpy.mockRestore()
    })

    it('should hide typing indicator', async () => {
      const { ChatUI } = await import('../components/index.js')

      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      const chat = new ChatUI()
      chat.hideTyping()

      expect(writeSpy).toHaveBeenCalled()

      writeSpy.mockRestore()
    })

    it('should clear history', async () => {
      const { ChatUI } = await import('../components/index.js')

      const clearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {})

      const chat = new ChatUI()
      chat.clear()

      expect(clearSpy).toHaveBeenCalled()

      clearSpy.mockRestore()
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
      const handler = vi.fn()

      commands.register('/test', 'Test command', handler)
      expect(commands.list()).toContain('/test')
    })

    it('should execute command', async () => {
      const { CommandPalette } = await import('../components/index.js')

      const commands = new CommandPalette()
      const handler = vi.fn()

      commands.register('/test', 'Test command', handler)
      const result = commands.execute('/test')

      expect(result).toBe(true)
      expect(handler).toHaveBeenCalled()
    })

    it('should return false for unknown command', async () => {
      const { CommandPalette } = await import('../components/index.js')

      const commands = new CommandPalette()
      const result = commands.execute('/unknown')

      expect(result).toBe(false)
    })

    it('should show help', async () => {
      const { CommandPalette } = await import('../components/index.js')

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const commands = new CommandPalette()
      commands.register('/test', 'Test command', () => {})
      commands.showHelp()

      expect(logSpy).toHaveBeenCalled()

      logSpy.mockRestore()
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

      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      const status = new StatusBar()
      status.update('Processing', 'step 1')

      expect(writeSpy).toHaveBeenCalled()

      writeSpy.mockRestore()
    })

    it('should clear status', async () => {
      const { StatusBar } = await import('../components/index.js')

      const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)

      const status = new StatusBar()
      status.clear()

      expect(writeSpy).toHaveBeenCalled()

      writeSpy.mockRestore()
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

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const logs = new LogPanel()
      logs.log('info', 'test message')

      const allLogs = logs.getLogs()
      expect(allLogs).toHaveLength(1)
      expect(allLogs[0].level).toBe('info')
      expect(allLogs[0].message).toBe('test message')

      logSpy.mockRestore()
    })

    it('should limit max logs', async () => {
      const { LogPanel } = await import('../components/index.js')

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const logs = new LogPanel()

      for (let i = 0; i < 150; i++) {
        logs.log('info', `message ${i}`)
      }

      const allLogs = logs.getLogs()
      expect(allLogs.length).toBeLessThanOrEqual(100)

      logSpy.mockRestore()
    })

    it('should add different log levels', async () => {
      const { LogPanel } = await import('../components/index.js')

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const logs = new LogPanel()
      logs.log('warn', 'warning message')
      logs.log('error', 'error message')
      logs.log('debug', 'debug message')

      const allLogs = logs.getLogs()
      expect(allLogs).toHaveLength(3)

      logSpy.mockRestore()
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

      const clearSpy = vi.spyOn(console, 'clear').mockImplementation(() => {})
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const tui = new TUI()
      await tui.start('Test')

      expect(clearSpy).toHaveBeenCalled()
      expect(logSpy).toHaveBeenCalled()

      clearSpy.mockRestore()
      logSpy.mockRestore()
    })
  })
})
