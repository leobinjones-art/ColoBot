#!/usr/bin/env node
/**
 * ColoBot CLI 入口
 */

import { TUI, printError, style } from './index.js';

async function main() {
  const tui = new TUI();

  // 注册自定义命令
  tui.commands.register('/exit', '退出程序', () => {
    console.log('\n再见！\n');
    process.exit(0);
  });

  tui.commands.register('/version', '显示版本', () => {
    console.log(`\nColoBot v${process.env.npm_package_version || '0.1.0'}\n`);
  });

  await tui.start();

  // 模拟消息处理
  await tui.run(async (message) => {
    // 这里应该调用 @colobot/core 的运行时
    // 目前返回模拟响应
    await new Promise(resolve => setTimeout(resolve, 500));
    return `收到: ${message}`;
  });
}

main().catch((error) => {
  printError('启动失败', error);
  process.exit(1);
});
