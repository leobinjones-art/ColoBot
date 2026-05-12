# 法律条文学习目录

此目录存放 Sentinel 学习后的法律条文。

## 工作流程

1. **上传文档** → 调用 `legalLearner.learn(law, article, content)`
2. **LLM 提纯** → 自动提取关键词、标签、摘要
3. **持久化存储** → 保存为 JSON 文件到此目录
4. **规则库检索** → 通过关键词搜索匹配相关条文

## 使用示例

```typescript
import { getLegalLearner } from '@colomind/sentinel'

const learner = getLegalLearner({
  llmProvider: yourLLMProvider,
  storagePath: './legal-docs/learned'
})

// 学习单条法律
await learner.learn(
  '中华人民共和国动物防疫法',
  '第二十一条',
  '动物尸体应当按照国家规定进行无害化处理，不得随意丢弃。'
)

// 批量学习
await learner.learnBatch([
  { law: '网络安全法', article: '第二十七条', content: '...' },
  { law: '刑法', article: '第二百八十五条', content: '...' },
])

// 搜索相关条文
const results = learner.search('动物尸体处理')
```

## 文件格式

学习后自动生成 JSON 文件：

```json
{
  "id": "中华人民共和国动物防疫法-第二十一条",
  "law": "中华人民共和国动物防疫法",
  "article": "第二十一条",
  "content": "动物尸体应当按照国家规定进行无害化处理...",
  "keywords": ["动物尸体", "无害化处理", "宠物"],
  "tags": ["动物", "防疫"],
  "summary": "动物尸体必须无害化处理，禁止随意丢弃",
  "createdAt": "2026-05-08T03:00:00.000Z"
}
```
