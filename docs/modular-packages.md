# ColoBot 模块化拆包方案

## 目标

将 ColoBot 拆分为独立 npm 包，支持按需安装，降低部署复杂度。

## 设计原则

1. **核心最小化** - core 只包含必要功能
2. **插件机制** - 可选包通过插件注册能力
3. **命令行优先** - 配置管理优先使用 TUI/CLI，Dashboard 可选
4. **类型共享** - 独立 types 包，所有包共用

## 包结构

```
packages/
├── types/                   # @colobot/types - 共享类型（新增）
│   ├── src/
│   │   ├── agent.ts         # Agent 类型
│   │   ├── llm.ts           # LLM 类型
│   │   ├── memory.ts        # 记忆类型
│   │   ├── tool.ts          # 工具类型
│   │   ├── config.ts        # 配置类型
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── core/                    # @colobot/core - 核心包（必需）
│   ├── src/
│   │   ├── agent-runtime/   # Agent 运行时
│   │   ├── llm/             # LLM 抽象层（含 MiniMax/OpenAI/Anthropic）
│   │   ├── memory/          # 记忆系统
│   │   ├── config/          # 配置管理
│   │   ├── plugin/          # 插件机制
│   │   │   ├── registry.ts  # 插件注册
│   │   │   └── types.ts     # 插件类型
│   │   ├── utils/           # 工具函数
│   │   └── index.ts         # 导出入口
│   ├── package.json
│   └── tsconfig.json
│
├── tui/                     # @colobot/tui - 终端界面
│   ├── src/
│   │   ├── app.tsx          # 主应用
│   │   ├── chat/            # 对话界面
│   │   ├── sop/             # SOP 界面
│   │   ├── config/          # 配置管理（命令行）
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
│
├── sop/                     # @colobot/sop - SOP 流程（可选）
│   ├── src/
│   │   ├── index.ts         # 导出 + 插件注册
│   │   ├── plugin.ts        # SOP 插件定义
│   │   └── ...
│   └── ...
│
├── feishu/                  # @colobot/feishu - 飞书集成（可选）
│   ├── src/
│   │   ├── index.ts         # 导出 + 插件注册
│   │   ├── plugin.ts        # 飞书插件定义
│   │   └── ...
│   └── ...
│
├── skills-openclaw/         # @colobot/skills-openclaw（可选）
├── tools-minimax/           # @colobot/tools-minimax（可选）
├── dashboard/               # @colobot/dashboard - Web 管理界面（可选）
└── server/                  # @colobot/server - 完整服务
```

## 插件机制

### 插件接口

```typescript
// @colobot/types
interface ColoBotPlugin {
  name: string
  version: string
  
  // 工具注册
  tools?: ToolDefinition[]
  
  // 配置 Schema
  configSchema?: ConfigSchema
  
  // CLI 命令
  cliCommands?: CLICommand[]
  
  // 初始化钩子
  onInit?: (context: PluginContext) => void | Promise<void>
}
```

### 插件注册

```typescript
// @colobot/core
import { registerPlugin, getPlugins } from '@colobot/core'

// 注册插件
registerPlugin({
  name: 'sop',
  version: '0.1.0',
  tools: [...sopTools],
  configSchema: sopConfigSchema,
  cliCommands: [
    { name: 'sop:list', handler: listSopTasks },
    { name: 'sop:resume', handler: resumeSop }
  ]
})

// 获取所有插件
const plugins = getPlugins()
```

### 可选包自动注册

```typescript
// @colobot/sop/src/index.ts
import { registerPlugin } from '@colobot/core'
import { sopPlugin } from './plugin.js'

// 包导入时自动注册
registerPlugin(sopPlugin)

export { aiAnalyzeTask, createSop, ... }
```

## 配置管理（CLI 优先）

### TUI 配置界面

```bash
# 打开配置管理
colobot config

# 直接设置
colobot config set llm.provider openai
colobot config set llm.api_key sk-xxx

# 设置 SOP 配置
colobot config set sop.prompts.taskAnalysis "custom prompt..."

# 设置飞书配置
colobot config set feishu.app_id cli_xxx
```

### 配置存储

```typescript
// 统一配置管理
import { ConfigManager } from '@colobot/core'

// 获取配置
const provider = ConfigManager.get('llm.provider')

// 设置配置（自动持久化到数据库）
await ConfigManager.set('llm.api_key', 'sk-xxx')

// 获取所有配置
const config = ConfigManager.getAll()
```

### 配置优先级

```
数据库 > 环境变量 > 默认值
```

## 依赖关系

```
@colobot/types
    ↑
    │ (所有包依赖)
    │
@colobot/core
    ↑
    ├── @colobot/sop
    ├── @colobot/feishu
    ├── @colobot/tools-minimax
    ├── @colobot/skills-openclaw
    │
@colobot/tui
    ↑
    └── @colobot/core (动态加载插件命令)
    
@colobot/dashboard (可选，轻量)
    ↑
    └── @colobot/core

@colobot/server
    ↑
    └── 所有包
```

## 安装方式

### 最小安装（仅核心 + TUI）

```bash
npm install @colobot/core @colobot/tui
```

功能：Agent 运行时、LLM 调用、记忆系统、终端配置

### 添加 SOP 流程

```bash
npm install @colobot/sop
# 导入时自动注册插件，TUI 自动识别
```

### 添加飞书集成

```bash
npm install @colobot/feishu
```

### 添加 MiniMax 工具

```bash
npm install @colobot/tools-minimax
```

### 完整安装

```bash
npm install @colobot/server
```

## TUI 动态命令

TUI 根据已安装的插件动态显示命令：

```bash
# 仅安装 core + tui
colobot> /help
  /config    配置管理
  /new       新对话
  /quit      退出

# 安装 sop 后
colobot> /help
  /config    配置管理
  /new       新对话
  /sop       SOP 流程
  /sop:list  任务列表
  /quit      退出

# 安装 feishu 后
colobot> /help
  /config    配置管理
  /new       新对话
  /sop       SOP 流程
  /feishu    飞书状态
  /quit      退出
```

## Dashboard 定位

Dashboard 是**可选的**轻量 Web 界面：

- 仅显示核心功能（Agent、LLM、配置）
- 不依赖可选包的 UI 组件
- 可选包的配置通过 TUI/CLI 管理

```
┌─────────────────────────────────────────────────────────────┐
│ ColoBot Dashboard                                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  核心 Tab:  [Agents] [LLM] [Memory] [Config]               │
│                                                             │
│  注: SOP/Feishu 等配置请使用 TUI 命令:                      │
│    colobot config                                           │
│    colobot config set sop.xxx ...                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 开发计划

| 阶段 | 内容 | 时间 |
|------|------|------|
| Phase 0 | @colobot/types 类型包 | 1 天 |
| Phase 1 | @colobot/core + 插件机制 | 3 天 |
| Phase 2 | @colobot/tui 终端界面 | 5 天 |
| Phase 3 | @colobot/sop 插件化 | 2 天 |
| Phase 4 | @colobot/feishu 插件化 | 2 天 |
| Phase 5 | @colobot/tools-minimax | 3 天 |
| Phase 6 | @colobot/skills-openclaw | 3 天 |
| Phase 7 | @colobot/dashboard（轻量） | 1 天 |
| Phase 8 | @colobot/server 整合 | 1 天 |
| **总计** | | **21 天** |

## 优势

1. **真正的按需安装** - 只装需要的包
2. **配置统一** - CLI/TUI 统一管理，Dashboard 可选
3. **插件自动发现** - 导入即注册，无需手动配置
4. **类型安全** - 共享类型包，开发体验好
5. **轻量 Dashboard** - 不依赖可选包，降低复杂度
