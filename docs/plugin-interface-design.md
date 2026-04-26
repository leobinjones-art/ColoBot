# ColoBot 插件接口需求分析

## 1. @colobot/sop-academic

**功能：学术研究 SOP 流程**

| 能力 | 接口 | 说明 |
|------|------|------|
| 状态持久化 | `saveState(key, state)` | 保存流程状态 |
| | `loadState(key)` | 加载流程状态 |
| | `listStates(filter)` | 列出活跃流程 |
| LLM 调用 | `chat(prompt, options)` | AI 分析任务、生成引导、审核 |
| 子 Agent | `createAgent(config)` | 创建步骤专用 Agent |
| | `runAgent(agentId, task)` | 执行子任务 |
| | `destroyAgent(agentId)` | 销毁子 Agent |
| 记忆 | `searchMemory(query, limit)` | 搜索历史步骤结果 |
| 文件 | `writeFile(path, content)` | 生成最终报告 |

---

## 2. @colobot/feishu

**功能：飞书集成**

| 能力 | 接口 | 说明 |
|------|------|------|
| 消息推送 | `sendMessage(userId, content)` | 发送消息 |
| | `sendCard(userId, card)` | 发送交互式卡片 |
| | `updateCard(messageId, card)` | 更新卡片内容 |
| 审批回调 | `onApproval(callback)` | 处理审批按钮点击 |
| 用户信息 | `getUserInfo(userId)` | 获取用户信息 |
| 配置 | `getFeishuConfig()` | 获取飞书配置 |
| | `setFeishuConfig(config)` | 设置飞书配置 |

---

## 3. @colobot/dashboard

**功能：Web 管理界面**

| 能力 | 接口 | 说明 |
|------|------|------|
| 配置管理 | `getConfig(key)` | 获取配置 |
| | `setConfig(key, value)` | 设置配置 |
| | `listConfigs()` | 列出所有配置 |
| Agent 管理 | `listAgents()` | 列出 Agent |
| | `createAgent(config)` | 创建 Agent |
| | `updateAgent(id, config)` | 更新 Agent |
| | `deleteAgent(id)` | 删除 Agent |
| Skill 管理 | `listSkills()` | 列出 Skill |
| | `createSkill(config)` | 创建 Skill |
| | `deleteSkill(id)` | 删除 Skill |
| 审批管理 | `listApprovals(filter)` | 列出审批记录 |
| | `getApproval(id)` | 获取审批详情 |
| 审计日志 | `listAuditLogs(filter)` | 查询审计日志 |
| 安全中心 | `listPoisonAttempts()` | 查看投毒尝试 |
| | `rollbackContent(id)` | 回滚污染内容 |

---

## 4. @colobot/tools-minimax

**功能：MiniMax 工具**

| 能力 | 接口 | 说明 |
|------|------|------|
| TTS | `tts(text, options)` | 文本转语音 |
| ASR | `asr(audioUrl)` | 语音转文本 |
| 图像生成 | `imageGen(prompt)` | 文生图 |
| 视频生成 | `videoGen(prompt)` | 文生视频 |
| 音乐生成 | `musicGen(prompt)` | 音乐生成 |
| 文件操作 | `uploadFile(file)` | 上传文件 |
| | `downloadFile(fileId)` | 下载文件 |
| 配置 | `getMinimaxConfig()` | 获取 MiniMax 配置 |

---

## 5. @colobot/skills-openclaw

**功能：OpenClaw Skill 兼容**

| 能力 | 接口 | 说明 |
|------|------|------|
| Skill 导入 | `parseOpenClawSoul(markdown)` | 解析 SOUL.md |
| | `importSkill(soul)` | 导入 Skill |
| Skill 注册 | `registerSkill(skill)` | 注册到 Skill 库 |
| | `listImportedSkills()` | 列出已导入 Skill |

---

## 统一接口设计

### 核心 Runtime 接口

```typescript
interface ColoBotRuntime {
  // === 状态管理 ===
  saveState(namespace: string, key: string, state: unknown): Promise<void>;
  loadState(namespace: string, key: string): Promise<unknown | null>;
  listStates(namespace: string, filter?: StateFilter): Promise<unknown[]>;
  
  // === LLM ===
  chat(prompt: string, options?: ChatOptions): Promise<string>;
  
  // === Agent ===
  createAgent(config: AgentConfig): Promise<string>;
  runAgent(agentId: string, task: string): Promise<string>;
  destroyAgent(agentId: string): Promise<void>;
  listAgents(): Promise<AgentInfo[]>;
  
  // === Skill ===
  registerSkill(skill: Skill): Promise<void>;
  listSkills(): Promise<Skill[]>;
  executeSkill(skillId: string, input: unknown): Promise<unknown>;
  
  // === 记忆 ===
  searchMemory(query: string, limit?: number): Promise<MemoryResult[]>;
  
  // === 文件 ===
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  
  // === 配置 ===
  getConfig(key: string): Promise<unknown>;
  setConfig(key: string, value: unknown): Promise<void>;
  
  // === 审批 ===
  listApprovals(filter?: ApprovalFilter): Promise<Approval[]>;
  
  // === 审计 ===
  listAuditLogs(filter?: AuditFilter): Promise<AuditLog[]>;
  
  // === 消息推送（可选） ===
  sendMessage?(channel: string, userId: string, content: unknown): Promise<string>;
  updateMessage?(channel: string, messageId: string, content: unknown): Promise<void>;
}
```

### 插件扩展接口

```typescript
interface PluginExtension {
  // MiniMax 扩展
  minimax?: {
    tts(text: string, options?: TtsOptions): Promise<string>;
    asr(audioUrl: string): Promise<string>;
    imageGen(prompt: string): Promise<string>;
    videoGen(prompt: string): Promise<string>;
    musicGen(prompt: string): Promise<string>;
  };
  
  // 飞书扩展
  feishu?: {
    sendCard(userId: string, card: unknown): Promise<string>;
    updateCard(messageId: string, card: unknown): Promise<void>;
    getUserInfo(userId: string): Promise<UserInfo>;
  };
}
```