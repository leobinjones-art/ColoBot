# @colobot/skills-openclaw - OpenClaw Skill 库兼容

## 概述

`@colobot/skills-openclaw` 提供 OpenClaw Skill 库的兼容适配器，让 ColoBot 能够导入和使用 OpenClaw 格式的 Skill 定义。

## OpenClaw Skill 格式

OpenClaw 使用 YAML 格式定义 Skill：

```yaml
name: code-review
description: 自动代码审查
triggers:
  - pattern: "review"
  - pattern: "代码审查"
  - pattern: "检查代码"
  
tools:
  - read_file
  - search_memory
  - web_search
  
prompt: |
  你是一个代码审查助手。
  
  审查规则：
  1. 检查代码风格
  2. 检查潜在 bug
  3. 检查安全问题
  
  输出格式：
  - 问题列表
  - 改进建议

examples:
  - input: "review this code"
    output: |
      发现以下问题：
      1. ...
      
metadata:
  version: "1.0.0"
  author: "colobot"
  tags: ["code", "review"]
```

## 功能特性

| 功能 | 说明 |
|------|------|
| 📥 导入 YAML | 从 YAML 文件导入 Skill |
| 🔄 格式转换 | OpenClaw → ColoBot 格式 |
| ✅ 验证 | 验证 Skill 定义完整性 |
| 📦 批量导入 | 导入整个 Skill 库 |
| 🔗 触发器映射 | Pattern → Trigger Words |
| 🛠️ 工具映射 | OpenClaw 工具 → ColoBot 工具 |

## 安装

```bash
npm install @colobot/skills-openclaw
```

## 使用

### 导入单个 Skill

```typescript
import { importOpenClawSkill } from '@colobot/skills-openclaw'

// 从 YAML 文件导入
const skill = await importOpenClawSkill('./skills/code-review.yaml')

// 保存到 ColoBot
await saveSkill(skill)
```

### 批量导入

```typescript
import { importOpenClawLibrary } from '@colobot/skills-openclaw'

// 导入整个目录
const skills = await importOpenClawLibrary('./openclaw-skills/')

// 批量保存
for (const skill of skills) {
  await saveSkill(skill)
}
```

### 验证 Skill

```typescript
import { validateOpenClawSkill } from '@colobot/skills-openclaw'

const yamlContent = fs.readFileSync('./skill.yaml', 'utf-8')
const result = validateOpenClawSkill(yamlContent)

if (result.valid) {
  console.log('Skill 验证通过')
} else {
  console.log('验证失败:', result.errors)
}
```

## 格式映射

### OpenClaw → ColoBot

| OpenClaw | ColoBot |
|----------|---------|
| `name` | `name` |
| `description` | `description` |
| `triggers[].pattern` | `trigger_words` |
| `tools` | `allowed_tools` |
| `prompt` | `markdown_content` |
| `examples` | 转换为文档示例 |
| `metadata.version` | `version` |
| `metadata.tags` | `tags` |

### 工具映射表

| OpenClaw 工具 | ColoBot 工具 |
|---------------|--------------|
| `read_file` | `read_file` |
| `write_file` | `write_file` |
| `search` | `web_search` |
| `search_memory` | `search_memory` |
| `execute` | `execute_command` |
| `http_request` | `http_fetch` |
| `database` | `query` |

## API

### importOpenClawSkill

```typescript
function importOpenClawSkill(
  source: string | Buffer,  // YAML 文件路径或内容
  options?: ImportOptions
): Promise<ColoBotSkill>

interface ImportOptions {
  validate?: boolean        // 是否验证（默认 true）
  toolMapping?: Record<string, string>  // 自定义工具映射
  defaultTools?: string[]   // 默认工具列表
}
```

### importOpenClawLibrary

```typescript
function importOpenClawLibrary(
  directory: string,        // Skill 库目录
  options?: LibraryOptions
): Promise<ImportResult>

interface LibraryOptions {
  recursive?: boolean       // 递归搜索（默认 true）
  validate?: boolean
  skipInvalid?: boolean     // 跳过无效文件（默认 true）
}

interface ImportResult {
  skills: ColoBotSkill[]
  skipped: string[]         // 跳过的文件
  errors: ImportError[]     // 错误列表
}
```

### validateOpenClawSkill

```typescript
function validateOpenClawSkill(
  content: string | Buffer
): ValidationResult

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: string[]
}
```

### convertToColoBotFormat

```typescript
function convertToColoBotFormat(
  openClawSkill: OpenClawSkill
): ColoBotSkill
```

## 目录结构

```
packages/skills-openclaw/
├── src/
│   ├── index.ts            # 导出入口
│   ├── parser.ts           # YAML 解析器
│   ├── converter.ts        # 格式转换器
│   ├── validator.ts        # 验证器
│   ├── importer.ts         # 导入逻辑
│   ├── mappings/
│   │   ├── tools.ts        # 工具映射
│   │   └── triggers.ts     # 触发器映射
│   └── types/
│       ├── openclaw.ts     # OpenClaw 类型定义
│       └── colobot.ts      # ColoBot 类型定义
├── tests/
│   ├── parser.test.ts
│   ├── converter.test.ts
│   └── importer.test.ts
├── package.json
└── README.md
```

## 类型定义

```typescript
// OpenClaw Skill 格式
interface OpenClawSkill {
  name: string
  description: string
  triggers: OpenClawTrigger[]
  tools?: string[]
  prompt: string
  examples?: OpenClawExample[]
  metadata?: {
    version?: string
    author?: string
    tags?: string[]
  }
}

interface OpenClawTrigger {
  pattern: string
  type?: 'exact' | 'regex' | 'keyword'
  priority?: number
}

interface OpenClawExample {
  input: string
  output: string
}

// ColoBot Skill 格式
interface ColoBotSkill {
  id?: string
  name: string
  description: string
  trigger_words: string[]
  markdown_content: string
  allowed_tools?: string[]
  enabled: boolean
  version?: string
  tags?: string[]
  created_at?: string
}
```

## Dashboard 集成

在 Dashboard 的 Skill 页面添加 OpenClaw 导入功能：

```
┌─────────────────────────────────────────────────────────────┐
│ Skill Repository                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ [+ Create Skill]  [📁 Import OpenClaw]  [📦 Import Library] │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ Import OpenClaw Skill                                │    │
│ │                                                     │    │
│ │ YAML File: [选择文件...]                             │    │
│ │                                                     │    │
│ │ Tool Mapping:                                       │    │
│ │   search → web_search  ✓                            │    │
│ │   read_file → read_file  ✓                          │    │
│ │                                                     │    │
│ │ [Validate]  [Import]                                │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 依赖

```json
{
  "dependencies": {
    "@colobot/core": "^0.1.0",
    "yaml": "^2.3.4",          // YAML 解析
    "ajv": "^8.12.0"           // JSON Schema 验证
  }
}
```

## 开发计划

| 阶段 | 功能 | 时间 |
|------|------|------|
| Phase 1 | YAML 解析 + 类型定义 | 1 天 |
| Phase 2 | 格式转换 + 工具映射 | 1 天 |
| Phase 3 | 验证 + 错误处理 | 1 天 |
| Phase 4 | 批量导入 + Dashboard 集成 | 1 天 |
| **总计** | | **4 天** |

## 与其他包的关系

```
@colobot/skills-openclaw
    └── @colobot/core (必需)
```

## 使用场景

1. **迁移 Skill 库**：从 OpenClaw 迁移现有 Skill 到 ColoBot
2. **共享 Skill**：使用社区 OpenClaw Skill 定义
3. **批量管理**：导入整个 Skill 库目录
4. **格式转换**：OpenClaw ↔ ColoBot 双向转换