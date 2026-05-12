# @colomind/sentinel

安全守护智能体 - 输入输出扫描、进程守护、异常接管

## 概述

Sentinel 是一个基于三层防御架构的安全守护智能体，通过规则引擎、LLM意图分析和法律知识库的组合，有效识别和拦截恶意请求。

## 三层防御架构

```
┌─────────────────────────────────────────────────────────────┐
│                     第一层：规则引擎                         │
│            Trie敏感词 + 正则模式 + 频率限制                  │
│                   响应时间 <1ms                               │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  第二层：LLM意图分析                         │
│              语义理解 + 恶意意图识别 + 上下文分析              │
│                   响应时间 ~500ms                            │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  第三层：法律知识库                           │
│           法律条文匹配 + 合规性判断 + 拦截依据               │
│                   支持 CN/US/EU/JP 管辖区                    │
└─────────────────────────────────────────────────────────────┘
```

## 核心功能

### 1. 输入扫描

```typescript
import { InferenceAgent, getLegalKnowledgeBase } from '@colomind/sentinel'

const kb = getLegalKnowledgeBase()
await kb.loadFromDirectory('./legal-docs')

const agent = new InferenceAgent({
  llmProvider: yourLLMProvider,
  model: 'your-model'
})

const result = await agent.infer({
  message: userMessage,
  jurisdiction: 'CN'
})

if (result.needsTakeover) {
  // 拦截恶意请求
  console.log('拦截原因:', result.reasoning)
}
```

### 2. 法律知识库

支持加载自定义法律条文：

```
legal-docs/
├── CN/
│   ├── 刑法.txt
│   ├── 治安管理处罚法.txt
│   ├── 网络安全法.txt
│   └── ...
├── US/
│   └── ...
└── EU/
    └── ...
```

### 3. 意图分析

LLM层面的深度意图分析，识别：
- 直接违规请求
- 角色扮演攻击（"扮演..."、"假装..."）
- 学术伪装（"学术探讨"、"研究目的"）
- 多轮对话攻击
- 隐喻和编码请求

## 测试结果

基于1000+测试用例的拦截测试：

| 指标 | 数值 |
|------|------|
| 总测试用例 | 1049 |
| 拦截成功 | 745 |
| 放行 | 304 |
| **拦截率** | **71.03%** |

### 测试用例覆盖

- 🧪 直接违规请求（毒品、暴力、犯罪方法）
- 🎭 角色扮演攻击（扮演炼金术士、情报贩子等）
- 📚 学术/创作伪装（侦探小说、学术探讨）
- 🕵️ 多轮对话绕行
- 💔 情感操纵攻击
- 🚨 紧急情况伪装

### 行业对比

同类AI安全产品的典型拦截率在30-50%，Sentinel达到71%属于较好水平。

### 待优化方向

剩余29%漏放主要来自：
1. 高级角色扮演伪装
2. 多轮对话上下文攻击
3. 虚构创作场景伪装

## 安装

```bash
npm install @colomind/sentinel
```

## 开发

```bash
# 构建
npm run build

# 运行测试
npx ts-node test-1000.ts

# 运行完整测试
npx ts-node test-1000-cases.ts
```

## 文件结构

```
sentinel/
├── src/
│   ├── inference-agent.ts    # LLM意图分析
│   ├── legal-knowledge.ts    # 法律知识库
│   ├── rule-engine.ts        # 规则引擎
│   └── index.ts
├── legal-docs/
│   └── CN/                   # 中国法律条文
├── test-1000.ts              # 分类测试
├── test-1000-cases.ts        # 1000+用例测试
└── test-cases-1000.txt       # 测试用例数据
```

## License

AGPL-3.0
