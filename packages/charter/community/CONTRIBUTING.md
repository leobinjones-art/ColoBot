# Charter 社区贡献指南

## 概述

Charter 许可证系统支持社区贡献自定义许可证和文档库。任何人都可以创建新的 Charter 来扩展 AI 的能力边界。

## 贡献流程

### 1. 创建 Charter 定义

在 `community/` 目录下创建 JSON 文件：

```
community/
├── charter-{type}.json    # 许可证定义
└── library-{type}.json    # 对应的文档库
```

### 2. Charter 定义规范

```json
{
  "$schema": "https://nexusmind.org/schemas/charter.json",
  "id": "charter-{type}", // 必填：唯一ID，格式 charter-[a-z0-9-]+
  "type": "{type}", // 必填：类型标识
  "name": "Display Name", // 必填：显示名称
  "description": "Description...", // 必填：描述（10-500字符）
  "capabilities": [
    // 必填：能力列表
    {
      "name": "capability-name", // 必填：能力名称
      "description": "...", // 可选：能力描述
      "allowedTools": ["tool1"], // 可选：允许的工具
      "disallowedTools": ["tool2"], // 可选：禁止的工具
      "maxOutputLength": 100000, // 可选：最大输出长度
      "constraints": {} // 可选：额外约束
    }
  ],
  "libraryId": "library-{type}", // 必填：绑定的文档库ID
  "disclaimer": "...", // 可选：免责声明
  "validityMs": 86400000, // 可选：有效期（毫秒），1分钟-7天
  "requireConfirmation": true, // 可选：是否需要审批
  "author": {
    // 可选：作者信息
    "name": "Your Name",
    "email": "your@email.com",
    "url": "https://github.com/..."
  },
  "version": "1.0.0", // 可选：版本号
  "tags": ["tag1", "tag2"] // 可选：标签
}
```

### 3. Library 定义规范

```json
{
  "$schema": "https://nexusmind.org/schemas/library.json",
  "id": "library-{type}",            // 必填：唯一ID
  "name": "Library Name",            // 必填：名称
  "description": "Description...",   // 必填：描述
  "entries": [                        // 必填：条目列表
    {
      "id": "entry-id",              // 必填：条目ID
      "type": "template|regulation|guideline|reference|example",
      "title": "Entry Title",        // 必填：标题
      "content": "...",              // 必填：内容
      "tags": ["tag1"],              // 可选：标签
      "source": {                    // 可选：来源
        "url": "https://...",
        "author": "...",
        "date": "2024-01-01"
      }
    }
  ],
  "author": {...},                   // 可选：作者信息
  "version": "1.0.0",                // 可选：版本
  "license": "MIT|Apache-2.0|CC-BY-4.0|CC-BY-SA-4.0|proprietary"
}
```

### 4. 条目类型说明

| 类型       | 说明             | 示例               |
| ---------- | ---------------- | ------------------ |
| template   | 模板，可直接使用 | 合同模板、报告格式 |
| regulation | 规范，必须遵守   | 法律条款、行业规范 |
| guideline  | 指南，建议遵循   | 写作指南、最佳实践 |
| reference  | 参考资料         | 术语表、编码规范   |
| example    | 示例             | 代码示例、格式示例 |

## 提交贡献

### 方式一：GitHub PR

1. Fork 仓库
2. 在 `packages/charter/community/` 添加文件
3. 提交 Pull Request
4. 等待审核

### 方式二：直接加载

```typescript
import { loadCharter, loadLibrary } from '@nexusmind/charter'

// 加载自定义 Charter
const myCharter = require('./my-charter.json')
const result = loadCharter(myCharter)

if (result.valid) {
  console.log('Charter loaded successfully!')
} else {
  console.error('Validation failed:', result.errors)
}
```

## 审核标准

### Charter 审核

- [ ] ID 和 type 格式正确
- [ ] 至少包含一个 capability
- [ ] 绑定的 libraryId 存在
- [ ] validityMs 在合理范围（1分钟 - 7天）
- [ ] 免责声明清晰（如有风险）

### Library 审核

- [ ] ID 格式正确
- [ ] 至少包含一个 entry
- [ ] 条目内容准确、有用
- [ ] 标签合理，便于检索
- [ ] 来源可追溯（如有引用）

## 最佳实践

### 1. 能力粒度

- **太粗**：`document-writing`（过于宽泛）
- **太细**：`write-introduction-paragraph`（过于具体）
- **合适**：`paper-writing`, `contract-draft`, `clinical-report`

### 2. 文档库内容

- 提供可追溯的事实来源
- 包含必要的模板和规范
- 标签便于检索关联

### 3. 安全考虑

- 敏感领域需要 `requireConfirmation: true`
- 添加清晰的 `disclaimer`
- 限制 `allowedTools`

## 示例

查看 `community/` 目录下的示例文件：

- `charter-medical.json` - 医疗文档许可证
- `library-medical.json` - 医疗文档库

## 许可证

社区贡献的 Charter 和 Library 默认采用 CC-BY-4.0 许可证。如需其他许可证，请在文件中指定。
