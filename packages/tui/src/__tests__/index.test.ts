/**
 * @colobot/tui 测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('@colobot/tui', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('style and colors', () => {
    it('should style text', async () => {
      const { style, colors } = await import('../render/index.js');

      const styled = style('hello', 'red', 'bold');
      expect(styled).toContain('hello');
      expect(styled).toContain(colors.red);
      expect(styled).toContain(colors.bold);
    });

    it('should have color codes', async () => {
      const { colors } = await import('../render/index.js');

      expect(colors.red).toBeDefined();
      expect(colors.green).toBeDefined();
      expect(colors.blue).toBeDefined();
      expect(colors.reset).toBeDefined();
    });

    it('should create progress bar', async () => {
      const { progressBar } = await import('../render/index.js');

      const bar = progressBar(50, 100);
      expect(bar).toContain('50%');
    });
  });

  describe('ChatUI', () => {
    it('should create chat UI', async () => {
      const { ChatUI } = await import('../components/index.js');

      const chat = new ChatUI('Test Chat');
      expect(chat).toBeDefined();
    });
  });

  describe('CommandPalette', () => {
    it('should create command palette', async () => {
      const { CommandPalette } = await import('../components/index.js');

      const commands = new CommandPalette();
      expect(commands).toBeDefined();
      expect(commands.list()).toHaveLength(0);
    });

    it('should register command', async () => {
      const { CommandPalette } = await import('../components/index.js');

      const commands = new CommandPalette();
      const handler = vi.fn();

      commands.register('/test', 'Test command', handler);
      expect(commands.list()).toContain('/test');
    });

    it('should execute command', async () => {
      const { CommandPalette } = await import('../components/index.js');

      const commands = new CommandPalette();
      const handler = vi.fn();

      commands.register('/test', 'Test command', handler);
      const result = commands.execute('/test');

      expect(result).toBe(true);
      expect(handler).toHaveBeenCalled();
    });

    it('should return false for unknown command', async () => {
      const { CommandPalette } = await import('../components/index.js');

      const commands = new CommandPalette();
      const result = commands.execute('/unknown');

      expect(result).toBe(false);
    });
  });

  describe('StatusBar', () => {
    it('should create status bar', async () => {
      const { StatusBar } = await import('../components/index.js');

      const status = new StatusBar();
      expect(status).toBeDefined();
    });

    it('should update status', async () => {
      const { StatusBar } = await import('../components/index.js');

      const status = new StatusBar();
      status.update('Processing', 'step 1');
      // 不抛错即可
      expect(status).toBeDefined();
    });
  });

  describe('LogPanel', () => {
    it('should create log panel', async () => {
      const { LogPanel } = await import('../components/index.js');

      const logs = new LogPanel();
      expect(logs).toBeDefined();
    });

    it('should add logs', async () => {
      const { LogPanel } = await import('../components/index.js');

      const logs = new LogPanel();
      logs.log('info', 'test message');

      const allLogs = logs.getLogs();
      expect(allLogs).toHaveLength(1);
      expect(allLogs[0].level).toBe('info');
      expect(allLogs[0].message).toBe('test message');
    });

    it('should limit max logs', async () => {
      const { LogPanel } = await import('../components/index.js');

      const logs = new LogPanel();

      for (let i = 0; i < 150; i++) {
        logs.log('info', `message ${i}`);
      }

      const allLogs = logs.getLogs();
      expect(allLogs.length).toBeLessThanOrEqual(100);
    });
  });

  describe('TUI', () => {
    it('should create TUI instance', async () => {
      const { TUI } = await import('../index.js');

      const tui = new TUI();
      expect(tui).toBeDefined();
      expect(tui.chat).toBeDefined();
      expect(tui.commands).toBeDefined();
      expect(tui.status).toBeDefined();
      expect(tui.logs).toBeDefined();
    });

    it('should have default commands', async () => {
      const { TUI } = await import('../index.js');

      const tui = new TUI();
      const commands = tui.commands.list();

      expect(commands).toContain('/help');
      expect(commands).toContain('/clear');
    });
  });
});