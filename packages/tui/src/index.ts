/**
 * @colobot/tui - 终端界面
 */

import { createInput, ask, confirm, select } from './input/index.js';
import {
  colors,
  style,
  clear,
  printTitle,
  printDivider,
  printMessage,
  printStatus,
  printError,
  printSuccess,
  printWarning,
  printTable,
  progressBar,
} from './render/index.js';
import { ChatUI, CommandPalette, StatusBar, LogPanel } from './components/index.js';

/**
 * TUI 应用
 */
export class TUI {
  readonly chat: ChatUI;
  readonly commands: CommandPalette;
  readonly status: StatusBar;
  readonly logs: LogPanel;

  constructor() {
    this.chat = new ChatUI();
    this.commands = new CommandPalette();
    this.status = new StatusBar();
    this.logs = new LogPanel();

    // 注册默认命令
    this.commands.register('/help', '显示帮助', () => this.commands.showHelp());
    this.commands.register('/clear', '清空屏幕', () => {
      clear();
      this.logs.log('info', '屏幕已清空');
    });
  }

  /**
   * 启动 TUI
   */
  async start(title = 'ColoBot'): Promise<void> {
    clear();
    printTitle(title);
    console.log(`输入 ${style('/help', 'cyan')} 查看可用命令\n`);
  }

  /**
   * 运行交互循环
   */
  async run(onMessage: (message: string) => Promise<string>): Promise<void> {
    const input = createInput({ prompt: style('> ', 'cyan') });

    input.onLine(async (line) => {
      if (!line) {
        input.prompt();
        return;
      }

      // 命令处理
      if (line.startsWith('/')) {
        if (!this.commands.execute(line)) {
          this.logs.log('warn', `未知命令: ${line}`);
        }
        input.prompt();
        return;
      }

      // 消息处理
      this.chat.addMessage('user', line);

      try {
        this.status.update('处理中...');
        const response = await onMessage(line);
        this.status.clear();
        this.chat.addMessage('assistant', response);
      } catch (error) {
        this.status.clear();
        printError('处理失败', error as Error);
      }

      input.prompt();
    });

    input.prompt();
  }
}

// 导出所有
export * from './input/index.js';
export * from './render/index.js';
export * from './components/index.js';
