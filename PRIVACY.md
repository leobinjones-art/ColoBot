# ColoBot 隐私说明

## 核心框架（@colobot/core + @colobot/sentinel）

- **不收集、不存储、不注入**任何用户个人数据
- 安全母 Agent 仅做输入/输出内容安全审核，不读取用户身份信息
- 所有对话数据仅用于当前会话，不会持久化到本地存储

## 个人助理包（@colobot/assistant）

### 可选安装

`@colobot/assistant` 是完全可选的包。不安装则完全不涉及用户个人数据。

### 数据存储

- 18 个模块的数据存储在用户本地的 SQLite 或 PostgreSQL 中
- 数据**永远不会自动上传**到任何远程服务
- 仅在用户主动对话时作为上下文注入给 AI

### 数据维度

安装后，以下数据会在对话时自动注入为上下文：

| 维度     | 来源模块                 | 隐私等级 |
| -------- | ------------------------ | -------- |
| 心理状态 | Mood Journal             | 中       |
| 生活习惯 | Habit Tracking, Health   | 中       |
| 工作效率 | Todo List, Time Tracking | 低       |
| 社交关系 | Contacts                 | 中       |
| 财务状况 | Finance                  | **高**   |
| 健康状况 | Health Tracking          | **高**   |
| 成长目标 | Goals, Learning, Reading | 低       |

### 用户控制

- 输入 `/context` 查看当前注入的上下文维度
- 卸载 `@colobot/assistant` 即停止所有个人数据的收集和使用

```bash
# 卸载个人助理包
npm uninstall @colobot/assistant
```

## 数据安全

- **Password Manager** 模块使用 AES-256 加密存储密码
- 所有本地数据可通过配置启用额外加密层
- 用户可随时导出或删除所有数据

## 信任承诺

ColoBot 的设计理念：

1. **安全母 Agent 守护你不被模型伤害** — 输入/输出双重审核
2. **你自己的数据完全在你自己手里** — 本地存储，可选安装

这两个信任锚点确保你对 AI Agent 的掌控权。
