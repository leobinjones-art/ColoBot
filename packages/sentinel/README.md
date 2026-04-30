# @colobot/sentinel

安全守护母 Agent - 输入输出扫描、进程守护、异常接管

## 为什么需要独立的安全守护母 Agent？

### 问题背景

在多 Agent 架构中，父 Agent 负责任务分解和审核，子 Agent 负责具体执行。这种架构存在以下风险：

1. **父 Agent 崩溃** - 子 Agent 失去控制，资源泄漏
2. **子 Agent 死锁** - 任务卡住，用户无响应
3. **恶意输入** - Prompt 注入攻击绕过安全检查
4. **有害输出** - 生成不合规内容直接返回用户
5. **长期无响应** - 任务执行超时，用户体验差

### 传统方案的局限

```
┌─────────────────────────────────────────┐
│           父 Agent（业务+安全）           │
│  ┌─────────────┐  ┌─────────────┐       │
│  │  业务逻辑   │  │  安全检查   │       │
│  └─────────────┘  └─────────────┘       │
└─────────────────────────────────────────┘
```

**问题：**

- 安全检查和业务逻辑耦合，互相影响
- 父 Agent 崩溃时，安全机制也随之失效
- 无法独立监控父 Agent 的健康状态
- 接管时缺乏上下文信息

### 平行链路架构

```
                    ┌─────────────────────────┐
                    │      安全守护母 Agent    │
                    │   (平行链路，独立运行)    │
                    └─────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            │                 │                 │
            ▼                 ▼                 ▼
     ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
     │  输入扫描    │  │  进程守护    │  │  输出扫描    │
     │  异常接管    │  │  健康监控    │  │  内容过滤    │
     └──────────────┘  └──────────────┘  └──────────────┘
            │                 │                 │
            └─────────────────┼─────────────────┘
                              │
                              ▼
                    ┌─────────────────────────┐
                    │      父 Agent           │
                    │    (业务主链路)          │
                    └─────────────────────────┘
```

**优势：**

- **独立监控** - 母 Agent 独立于业务链路，不受父 Agent 崩溃影响
- **异常接管** - 父 Agent 失联时自动接管，用户无感知
- **上下文保留** - 持续同步状态，接管时有完整上下文
- **分层防御** - 三层架构确保可靠性

## 三层防御架构

### 第一层：规则引擎（纯内存，永不失败）

```typescript
// 响应时间 <1ms，绝不阻塞
const result = sentinel.scanInput(message, sessionId)
if (!result.pass) {
  return result.response // 静态兜底话术
}
```

- Trie 树敏感词匹配
- 正则模式检测
- 输入长度/频率限制
- **永不失败** - 纯内存操作，无外部依赖

### 第二层：本地分类模型（可选）

```typescript
// 响应时间 <10ms
const classification = await localModel.classify(text)
if (classification.flagged) {
  // 拦截有害内容
}
```

- ONNX TinyBERT 模型
- 检测：仇恨/色情/暴力/越狱
- 自动降级 - 模型加载失败时回退到规则引擎

### 第三层：LLM 接管回复

```typescript
// 仅在接管时调用
const message = await takeoverGenerator.generate({
  sessionId: 'session-1',
  reason: 'timeout',
  lastUserMessage: '帮我查询天气',
})
```

- 生成自然的替代回复
- 引导用户转向合规话题
- 失败时使用预置静态话术兜底

## 核心功能

### 1. 输入扫描（同步）

```typescript
const sentinel = new Sentinel()
sentinel.start()

// 扫描输入，<1ms 响应
const result = sentinel.scanInput(userMessage, sessionId)
if (!result.pass) {
  // 返回兜底话术
  return sentinel.scanInputWithTakeover(userMessage, sessionId).response
}
```

### 2. 输出扫描（异步）

```typescript
const scanner = new OutputScanner(sentinel, {
  enabled: true,
  recallCallback: (sessionId, original, replacement) => {
    // 撤回并替换
    pusher.pushReplacement(sessionId, replacement)
  },
})

// 先放行，异步检测
const response = scanner.scanAsync(llmOutput, sessionId)
```

### 3. 心跳监控

```typescript
// 父 Agent 侧：发送心跳
const sender = new HeartbeatSender('parent-agent-1')
sender.start()

// 母 Agent 侧：监控心跳
const monitor = new HeartbeatMonitor()
monitor.setOnAgentDead((agentId) => {
  console.log(`Agent ${agentId} is dead, triggering takeover`)
})
monitor.start()
```

### 4. 会话超时监控

```typescript
// 30s 警告 → 60s 提示 → 120s 接管
sentinel.startSessionTimeout('session-1', 'agent-1')

// 定期检查超时消息
const messages = sentinel.getTimeoutMessages()
for (const msg of messages) {
  pusher.push(msg.sessionId, msg.message)
}
```

### 5. 状态同步

```typescript
// 父 Agent 侧：更新状态
const updater = sentinel.createStateUpdater('parent-agent-1')
updater.startProcessing('session-1', '用户问题')
updater.updateProgress('session-1', '正在搜索...', 50)
updater.finishProcessing('session-1', '回复内容')

// 母 Agent 侧：读取状态（接管时）
const state = sentinel.getSessionState('session-1')
// state.lastUserMessage, state.currentTask, state.taskProgress...
```

### 6. 接管信号

```typescript
// 触发接管
sentinel.triggerTakeover('session-1', 'timeout')

// 父 Agent 侧：监听接管信号
const receiver = sentinel.createSignalReceiver('parent-agent-1')
receiver.onTakeover((signal) => {
  // 停止当前任务，保存状态
  stopCurrentTask(signal.sessionId)
  receiver.sendAck(signal)
})
```

## 分布式支持

### Redis 共享状态

```typescript
import { createRedisClient, RedisStateStore } from '@colobot/sentinel'

const client = await createRedisClient({ host: 'localhost', port: 6379 })
const store = new RedisStateStore(client)

// 多进程共享状态
await store.saveSessionState(state)
const state = await store.getSessionState('session-1')
```

### Redis Pub/Sub

```typescript
import { RedisSignalBus, RedisTakeoverManager } from '@colobot/sentinel'

const signalBus = new RedisSignalBus(client)
const manager = new RedisTakeoverManager(signalBus)

// 跨进程信号通信
await manager.trigger('session-1', 'timeout')
```

## 接管场景

| 场景        | 检测方式 | 母 Agent 响应                        |
| ----------- | -------- | ------------------------------------ |
| Prompt 注入 | 输入扫描 | "检测到异常输入，请重新描述您的需求" |
| 有害输出    | 输出扫描 | 拦截并替换为安全提示                 |
| Agent 崩溃  | 心跳监控 | "系统遇到问题，正在恢复..."          |
| 长期无响应  | 超时检测 | "任务执行时间过长，是否继续？"       |
| 请求过快    | 频率限制 | "您的请求过于频繁，请稍后再试"       |

## 安装

```bash
npm install @colobot/sentinel
```

## 使用示例

```typescript
import { Sentinel } from '@colobot/sentinel'

// 创建安全守护
const sentinel = new Sentinel({
  heartbeatInterval: 2000,
  missedBeatsThreshold: 3,
  timeoutConfig: {
    warningMs: 30000,
    promptMs: 60000,
    takeoverMs: 120000,
  },
})

// 启动守护
sentinel.start()

// 输入扫描
const scanResult = sentinel.scanInput(userMessage, sessionId)
if (!scanResult.pass) {
  return sentinel.scanInputWithTakeover(userMessage, sessionId).response
}

// 开始会话超时监控
sentinel.startSessionTimeout(sessionId, agentId)

// ... 业务处理 ...

// 更新状态
const updater = sentinel.createStateUpdater(agentId)
updater.updateProgress(sessionId, 'Processing...', 50)

// 结束监控
sentinel.endSessionTimeout(sessionId)
```

## API

### Sentinel

主类，整合所有安全守护功能。

| 方法                                        | 说明                   |
| ------------------------------------------- | ---------------------- |
| `start()`                                   | 启动守护               |
| `stop()`                                    | 停止守护               |
| `scanInput(message, sessionId)`             | 扫描输入（同步）       |
| `scanInputWithTakeover(message, sessionId)` | 扫描输入并返回兜底话术 |
| `scanOutput(response)`                      | 扫描输出（同步）       |
| `startSessionTimeout(sessionId, agentId)`   | 开始超时监控           |
| `touchSession(sessionId)`                   | 重置超时计时           |
| `endSessionTimeout(sessionId)`              | 结束超时监控           |
| `getTimeoutMessages()`                      | 获取超时消息           |
| `createStateUpdater(agentId)`               | 创建状态更新器         |
| `getSessionState(sessionId)`                | 获取会话状态           |
| `triggerTakeover(sessionId, reason)`        | 触发接管               |
| `createSignalReceiver(agentId)`             | 创建信号接收器         |
| `beat()`                                    | 更新自身心跳           |
| `getSelfHealthStatus()`                     | 获取自身健康状态       |
| `externalCheck()`                           | 外部检查接口           |

## License

AGPL-3.0
