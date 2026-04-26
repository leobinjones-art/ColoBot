#!/usr/bin/env node
/**
 * ColoBot CLI 入口 - 纯 JS 避免 TypeScript 编译问题
 */

const args = process.argv.slice(2);
const firstArg = args[0];

// 快速处理 help/version，不加载任何模块
if (firstArg === 'help' || firstArg === '-h' || firstArg === '--help') {
  console.log(`
ColoBot - 多模态 AI 助手

用法:
  colobot [命令]

命令:
  init        交互式配置
  help        显示帮助
  version     显示版本

交互命令:
  /help       显示帮助
  /exit       退出程序
  /config     显示配置
  /tools      显示工具列表

配置文件:
  ~/.colobot/config.json
`);
  process.exit(0);
}

if (firstArg === 'version' || firstArg === '-v' || firstArg === '--version') {
  console.log(`ColoBot v${process.env.npm_package_version || '0.1.0'}`);
  process.exit(0);
}

// 加载主模块
import('./main.js');
