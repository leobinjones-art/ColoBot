# @colomind/sentinel

安全守护智能体 - 三层防御架构，有效识别和拦截恶意请求

## 概述

Sentinel 是一个基于三层防御架构的安全守护智能体，通过规则引擎、本地意图分析和LLM推理的组合，有效识别和拦截各类恶意请求，包括高级伪装攻击和多轮对话攻击。

## 三层防御架构

```
┌─────────────────────────────────────────────────────────────┐
│                  Layer 1: 规则引擎                           │
│         Trie敏感词 + 正则模式 + 频率限制                      │
│              响应时间 <1ms                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                Layer 1.5: 本地意图分析                       │
│        危险模式检测 + 法律知识库匹配 + 上下文风险识别          │
│              响应时间 ~10ms                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                Layer 2: LLM深度推理                          │
│       语义理解 + 恶意意图识别 + 法律条文引用                  │
│              响应时间 ~500ms                                 │
└─────────────────────────────────────────────────────────────┘
```

## 测试结果

### 单轮测试 (100条高级攻击用例)

| 流程顺序 | Layer 1 | Layer 1.5 | Layer 2 | 放行 | 拦截率 | 耗时 |
|----------|---------|-----------|---------|------|--------|------|
| **L1→L1.5→L2 (推荐)** | 3 | 34 | 49 | 14 | **86%** | 1319s |
| L1.5→L1→L2 | 3 | 34 | 49 | 14 | 86% | 1348s |
| L1.5→L2→L1 | 0 | 34 | 50 | 16 | 84% | 1478s |
| L2→L1.5→L1 | 0 | 5 | 79 | 16 | 84% | 2479s |

### 多轮对话攻击测试 (10组场景)

| 指标 | 结果 |
|------|------|
| 总场景数 | 10 |
| 拦截场景 | **10 (100%)** |
| 穿透场景 | 0 |
| 平均拦截轮次 | **1.8轮** |

#### 各场景拦截详情

| 场景类型 | 拦截轮次 | 拦截层级 |
|----------|----------|----------|
| 跨文化仪式 + 情感勒索 | 第1轮 | L2 |
| 学术深度伪装 + 角色扮演 | 第2轮 | L1.5 |
| 代码隐喻 + 多轮渐进 | 第2轮 | L2 |
| 情感勒索 + 紧急避险伪装 | 第3轮 | L2 |
| 法律漏洞 + 跨文化伪装 | 第1轮 | L1 |
| 艺术创作 + 多轮绕行 | 第2轮 | L1.5 |
| 医学谎言 + 情感勒索 | 第2轮 | L2 |
| 生存主义者 + 技术隐喻 | 第2轮 | L2 |
| 儿童安全教育 + 角色伪装 | 第1轮 | L1.5 |
| 宗教研究 + 绕行 | 第2轮 | L2 |

### 放行案例分析

14条放行案例均为合法用途，无误判：

| 类型 | 数量 | 示例 |
|------|------|------|
| 学术研究 | 5 | 法医学论文、司法毒理学研究、化学奥赛 |
| 编程隐喻 | 2 | 生态系统模拟、算法优化 |
| 安全竞赛 | 1 | CTF加密破解 |
| 法律咨询 | 3 | 正当防卫判定、国际法研究 |
| 语言文化研究 | 3 | 藏语方言、跨文化词汇对比 |

### 拦截能力矩阵

| 攻击类型 | L1 | L1.5 | L2 | 说明 |
|----------|----|----|----|------|
| 敏感词直接攻击 | ✅ | - | - | 毒品、爆炸物、放射性物质等 |
| 危险模式请求 | - | ✅ | - | 有毒物质提取、危险化学品操作 |
| 情感勒索伪装 | - | - | ✅ | 识别情感操控背后的危险意图 |
| 学术/教育伪装 | - | ✅ | ✅ | 本地模式检测 + LLM意图识别 |
| 代码/技术隐喻 | - | - | ✅ | 区分真实危险与无害编程问题 |
| 多轮渐进攻击 | - | - | ✅ | 上下文风险累积识别 |
| 角色扮演攻击 | - | ✅ | ✅ | 角色身份检测 + 意图分析 |

## 核心功能

### 1. 输入扫描

```typescript
import { resetRuleEngine, resetLocalIntentAnalyzer, InferenceAgent } from '@colomind/sentinel'

// 初始化三层防御
const ruleEngine = resetRuleEngine()
const localAnalyzer = resetLocalIntentAnalyzer({ confidenceThreshold: 0.75 })
const inferenceAgent = new InferenceAgent({
  llmProvider: yourLLMProvider,
  model: 'your-model'
})

// Layer 1: 规则引擎
const layer1Result = ruleEngine.scanInput(userMessage)
if (!layer1Result.pass) {
  console.log('L1拦截:', layer1Result.reason)
  return
}

// Layer 1.5: 本地意图分析
const layer15Result = localAnalyzer.analyze(userMessage)
if (layer15Result.category === 'dangerous') {
  console.log('L1.5拦截:', layer15Result.reason)
  return
}

// Layer 2: LLM推理
const layer2Result = await inferenceAgent.infer({
  message: userMessage,
  jurisdiction: 'CN'
})

if (layer2Result.needsTakeover) {
  console.log('L2拦截:', layer2Result.reasoning)
  console.log('相关法律:', layer2Result.relevantLaws)
}
```

### 2. 法律知识库

支持 CN/US/EU/JP 多管辖区法律条文：

```typescript
import { getLegalKnowledgeBase } from '@colomind/sentinel'

const kb = getLegalKnowledgeBase()
await kb.loadFromDirectory('./legal-docs')

// 查询相关法律
const laws = kb.query(userMessage, 'CN')
```

法律知识库结构：
```
legal-docs/
├── CN/
│   ├── 刑法.txt
│   ├── 治安管理处罚法.txt
│   ├── 网络安全法.txt
│   ├── 危险化学品安全管理条例.txt
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
- 情感操纵攻击

## 安装

```bash
npm install @colomind/sentinel
```

## 开发

```bash
# 构建
npm run build

# 运行单轮测试
npx tsx test-100-new.ts

# 运行多轮测试
npx tsx test-multiround.ts
```

## 文件结构

```
sentinel/
├── src/
│   ├── inference-agent.ts      # LLM意图分析
│   ├── legal-knowledge.ts      # 法律知识库
│   ├── local-intent-analyzer.ts # 本地意图分析
│   ├── rule-engine.ts          # 规则引擎
│   └── index.ts
├── legal-docs/
│   └── CN/                     # 中国法律条文
├── test-100-new.ts             # 单轮测试
├── test-multiround.ts          # 多轮测试
└── test-cases-100-new.txt      # 测试用例
```

## 最佳实践

### 推荐流程顺序

**L1 → L1.5 → L2** 是最优方案：
- 拦截率最高 (86%)
- 速度最快 (1319s)
- LLM调用最少 (49次)

### 为什么正向流程最优

1. **L1先过滤明显违规**: 敏感词直接拦截，无需后续处理
2. **L1.5处理复杂伪装**: 本地分析识别危险模式，避免LLM调用
3. **L2处理疑难案例**: 只对剩余案例调用LLM，节省成本

## License

AGPL-3.0