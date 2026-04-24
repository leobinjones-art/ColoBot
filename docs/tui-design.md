# ColoBot TUI - 终端用户界面

## 概述

`@colobot/tui` 提供终端交互界面，让用户在命令行中直接使用 ColoBot 的核心功能，无需启动 Web 服务。

## 功能特性

### 核心功能

| 功能 | 说明 |
|------|------|
| 💬 对话模式 | 与 Agent 实时对话，支持多轮上下文 |
| 📋 SOP 流程 | 终端内执行学术研究 SOP 流程 |
| 🔧 配置管理 | 查看和修改配置 |
| 📊 任务列表 | 查看进行中的 SOP 任务 |
| 🔍 搜索记忆 | 搜索历史对话和知识库 |

### 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│ ColoBot TUI v0.1.0                              Agent: main │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🤖 Assistant:                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 你好！我是 ColoBot，有什么可以帮助你的？              │   │
│  │                                                     │   │
│  │ 支持的功能：                                         │   │
│  │ - 学术研究 SOP 流程                                  │   │
│  │ - 知识问答                                          │   │
│  │ - 文件处理                                          │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  👤 You:                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 开始量子计算研究                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Enter] 发送  [Ctrl+C] 退出  [Ctrl+L] 清屏  [Tab] 命令模式  │
└─────────────────────────────────────────────────────────────┘
```

### SOP 流程界面

```
┌─────────────────────────────────────────────────────────────┐
│ ColoBot TUI - SOP 流程                        步骤 2/5      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📋 任务：量子计算研究                                       │
│                                                             │
│  ✅ 1. 文献调研 (已完成)                                     │
│  🔄 2. 分析研究现状 (进行中)                                 │
│  ⏳ 3. 确定研究方法                                          │
│  ⏳ 4. 实验设计                                              │
│  ⏳ 5. 撰写报告                                              │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 当前步骤：分析研究现状                                │   │
│  │                                                     │   │
│  │ 请提供您已收集的文献信息，我将帮您分析研究现状。       │   │
│  │                                                     │   │
│  │ 您可以：                                             │   │
│  │ - 粘贴文献摘要                                       │   │
│  │ - 描述您已了解的研究方向                              │   │
│  │ - 输入 "跳过" 跳过此步骤                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ [Ctrl+P] 暂停  [Ctrl+R] 重启步骤  [Ctrl+S] 跳过  [Ctrl+Q] 退出│
└─────────────────────────────────────────────────────────────┘
```

## 命令模式

按 `Tab` 进入命令模式，支持以下命令：

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/new` | 开始新对话 |
| `/sop` | 查看 SOP 任务列表 |
| `/sop resume <id>` | 恢复 SOP 任务 |
| `/sop cancel` | 取消当前 SOP |
| `/config` | 查看配置 |
| `/config set <key> <value>` | 修改配置 |
| `/search <query>` | 搜索记忆 |
| `/export` | 导出对话历史 |
| `/clear` | 清屏 |
| `/quit` | 退出 |

## 安装使用

### 安装

```bash
npm install @colobot/tui
```

### 启动

```bash
# 直接启动
npx colobot-tui

# 指定配置
npx colobot-tui --config ~/.colobot/config.json

# 指定 Agent
npx colobot-tui --agent my-agent
```

### 配置文件

`~/.colobot/config.json`:

```json
{
  "apiEndpoint": "http://localhost:18792",
  "apiKey": "your-api-key",
  "defaultAgent": "main",
  "theme": "dark",
  "language": "zh"
}
```

## 技术实现

### 依赖

```json
{
  "dependencies": {
    "@colobot/core": "^0.1.0",
    "ink": "^4.4.1",           // React for CLI
    "react": "^18.2.0",
    "chalk": "^5.3.0",         // 终端颜色
    "blessed": "^0.1.81"       // 终端 UI（备选）
  }
}
```

### 目录结构

```
packages/tui/
├── src/
│   ├── index.ts              # 入口
│   ├── app.tsx               # 主应用组件
│   ├── components/
│   │   ├── Chat.tsx          # 对话组件
│   │   ├── SopFlow.tsx       # SOP 流程组件
│   │   ├── TaskList.tsx      # 任务列表
│   │   ├── ConfigPanel.tsx   # 配置面板
│   │   ├── InputBox.tsx      # 输入框
│   │   └── StatusBar.tsx     # 状态栏
│   ├── hooks/
│   │   ├── useAgent.ts       # Agent 连接
│   │   ├── useSop.ts         # SOP 状态
│   │   └── useInput.ts       # 输入处理
│   ├── utils/
│   │   ├── format.ts         # 格式化输出
│   │   └── commands.ts       # 命令解析
│   └── themes/
│       ├── dark.ts           # 暗色主题
│       └── light.ts          # 亮色主题
├── package.json
└── README.md
```

### 核心组件

```typescript
// src/app.tsx
import React from 'react'
import { Box, Text } from 'ink'
import { Chat } from './components/Chat'
import { SopFlow } from './components/SopFlow'
import { StatusBar } from './components/StatusBar'

export function App({ agentId, config }: Props) {
  const [mode, setMode] = React.useState<'chat' | 'sop'>('chat')
  const [sopState, setSopState] = React.useState(null)

  return (
    <Box flexDirection="column" height="100%">
      <Box flexGrow={1}>
        {mode === 'chat' ? (
          <Chat agentId={agentId} onSopStart={setSopState} />
        ) : (
          <SopFlow state={sopState} onComplete={() => setMode('chat')} />
        )}
      </Box>
      <StatusBar mode={mode} onModeChange={setMode} />
    </Box>
  )
}
```

```typescript
// src/components/Chat.tsx
import React from 'react'
import { Box, Text, useInput } from 'ink'
import { useAgent } from '../hooks/useAgent'

export function Chat({ agentId, onSopStart }: Props) {
  const [input, setInput] = React.useState('')
  const [messages, setMessages] = React.useState<Message[]>([])
  const { sendMessage, isLoading } = useAgent(agentId)

  useInput((char, key) => {
    if (key.return) {
      handleSend()
    } else if (key.backspace) {
      setInput(prev => prev.slice(0, -1))
    } else {
      setInput(prev => prev + char)
    }
  })

  const handleSend = async () => {
    if (!input.trim()) return
    
    const userMsg = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')

    const response = await sendMessage(input)
    setMessages(prev => [...prev, { role: 'assistant', content: response }])

    // 检测 SOP 触发
    if (response.sopTriggered) {
      onSopStart(response.sopState)
    }
  }

  return (
    <Box flexDirection="column">
      {messages.map((msg, i) => (
        <Box key={i} marginBottom={1}>
          <Text bold color={msg.role === 'user' ? 'cyan' : 'green'}>
            {msg.role === 'user' ? '👤 You:' : '🤖 Assistant:'}
          </Text>
          <Text>{msg.content}</Text>
        </Box>
      ))}
      <Box borderStyle="single" paddingX={1}>
        <Text dimColor>{input || '输入消息...'}</Text>
      </Box>
    </Box>
  )
}
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 发送消息 |
| `Tab` | 切换命令模式 |
| `Ctrl+C` | 退出程序 |
| `Ctrl+L` | 清屏 |
| `Ctrl+P` | 暂停 SOP |
| `Ctrl+R` | 重启当前步骤 |
| `Ctrl+S` | 跳过当前步骤 |
| `↑` / `↓` | 浏览历史消息 |
| `Esc` | 取消当前输入 |

## 与其他包的关系

```
@colobot/tui
    └── @colobot/core (必需)
    └── @colobot/sop (可选，用于 SOP 流程)
```

## 使用场景

1. **快速测试**：开发时快速测试 Agent 行为
2. **服务器环境**：无 GUI 环境下使用 ColoBot
3. **CI/CD 集成**：自动化脚本中调用
4. **远程调试**：SSH 连接服务器时使用

## 与 Dashboard 对比

| 特性 | TUI | Dashboard |
|------|-----|-----------|
| 运行环境 | 终端 | 浏览器 |
| 依赖 | 无 | 无 |
| 实时对话 | ✅ | ✅ |
| SOP 流程 | ✅ | ✅ |
| 配置管理 | 基础 | 完整 |
| 可视化 | 文本 | 图表 |
| 远程访问 | SSH | HTTP |

## 开发计划

| 阶段 | 功能 | 时间 |
|------|------|------|
| Phase 1 | 基础对话界面 | 2 天 |
| Phase 2 | SOP 流程集成 | 2 天 |
| Phase 3 | 命令模式 | 1 天 |
| Phase 4 | 主题和配置 | 1 天 |
| **总计** | | **6 天** |
