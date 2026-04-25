# @colobot/tui

ColoBot 终端界面包。

## 安装

```bash
npm install @colobot/tui
```

## CLI 使用

```bash
npx colobot
```

## 编程使用

```typescript
import { TUI } from '@colobot/tui';

const tui = new TUI();

// 注册命令
tui.commands.register('/hello', '打招呼', () => {
  console.log('Hello!');
});

// 启动
await tui.start('My Bot');

// 运行交互循环
await tui.run(async (message) => {
  // 调用 @colobot/core 处理消息
  return `回复: ${message}`;
});
```

## 组件

### ChatUI - 聊天界面

```typescript
import { ChatUI } from '@colobot/tui';

const chat = new ChatUI();
chat.addMessage('user', '你好');
chat.addMessage('assistant', '你好！有什么可以帮助你的？');
```

### CommandPalette - 命令面板

```typescript
import { CommandPalette } from '@colobot/tui';

const commands = new CommandPalette();
commands.register('/test', '测试命令', () => console.log('test'));
commands.execute('/test');
commands.showHelp();
```

### StatusBar - 状态栏

```typescript
import { StatusBar } from '@colobot/tui';

const status = new StatusBar();
status.update('处理中...', '正在生成回复');
status.clear();
```

### LogPanel - 日志面板

```typescript
import { LogPanel } from '@colobot/tui';

const logs = new LogPanel();
logs.log('info', '服务启动');
logs.log('error', '连接失败');
```

## 渲染工具

```typescript
import {
  style,
  colors,
  printTitle,
  printTable,
  progressBar,
} from '@colobot/tui';

// 样式化文本
console.log(style('红色加粗', 'red', 'bold'));

// 打印标题
printTitle('ColoBot');

// 打印表格
printTable(['名称', '状态'], [['任务1', '完成'], ['任务2', '进行中']]);

// 进度条
console.log(progressBar(50, 100));
```

## 输入工具

```typescript
import { ask, confirm, select } from '@colobot/tui';

// 文本输入
const name = await ask('你的名字: ');

// 确认
const ok = await confirm('继续吗?');

// 选择
const idx = await select('选择一项:', ['选项A', '选项B', '选项C']);
```

## 构建

```bash
npm run build
```

## License

Apache-2.0
