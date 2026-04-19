# ColoBot 社区建设指南

本文档提供完整的社区建设步骤和模板。

---

## 1. GitHub Discussions 设置

### 1.1 启用步骤（需要在GitHub网页操作）

1. 进入仓库页面 → **Settings** → 勾选 **Discussions**
2. 创建以下欢迎帖（复制下面的内容）

### 1.2 欢迎帖模板

**标题**: `👋 欢迎来到 ColoBot 社区！`

**内容**:
```markdown
# 欢迎来到 ColoBot 社区！ 🎉

感谢你对 ColoBot 的关注！

## 🚀 快速开始

- [项目文档](../README.md)
- [API参考](../docs/api-reference.md)
- [使用示例](../docs/examples.md)

## 💬 如何参与

- **提问**: Q&A 分类
- **建议**: Ideas 分类
- **分享**: Show and tell 分类

## 🤝 贡献代码

查看 [贡献指南](../CONTRIBUTING.md)

## 📜 社区准则

请遵守 [行为准则](../CODE_OF_CONDUCT.md)
```

---

## 2. 发布公告模板

### 2.1 GitHub Release 模板

**Tag**: `v0.1.0`
**Title**: `ColoBot v0.1.0 - 首个开源版本 🎉`

**内容**:
```markdown
# ColoBot v0.1.0 - 首个开源版本 🎉

## 🌟 项目简介

ColoBot 是一个开源的 AI 智能体协作平台。

### 核心特性

- 🧠 父子智能体协作
- 📝 Skill 编排
- ⚖️ 四层审批漏斗
- 💾 向量记忆检索
- 📱 飞书集成
- 🌐 多LLM支持

## 📦 安装

```bash
git clone https://github.com/leobinjones-art/ColoBot.git
cd colobot && npm install
cp .env.example .env
docker compose up -d postgres
npm run db:init
npm run dev
```

## 📚 文档

- [完整文档](./README.md)
- [API参考](./docs/api-reference.md)
- [使用示例](./docs/examples.md)

## 🤝 贡献

欢迎所有形式的贡献！

## 📜 许可证

Apache 2.0
```

### 2.2 社交媒体发布

**Twitter/X**:
```
🚀 Excited to announce ColoBot - an open-source AI agent collaboration platform!

✨ Features:
- Multi-agent collaboration
- Skill orchestration  
- Auto-approval workflow
- Feishu integration

GitHub: https://github.com/leobinjones-art/ColoBot

#OpenSource #AI
```

**微信公众号标题**: `ColoBot 开源了！一个强大的 AI 智能体协作平台`

---

## 3. 已创建的文档

以下文档已为你准备好：

| 文档 | 路径 | 内容 |
|------|------|------|
| API参考 | `docs/api-reference.md` | 完整API文档 |
| 使用示例 | `docs/examples.md` | 多语言示例代码 |
| 架构设计 | `docs/architecture.md` | 已存在 |
| 部署指南 | `docs/deployment.md` | 已存在 |

---

## 4. 你需要做的操作清单

### 在GitHub网页上完成：

- [ ] Settings → 勾选 Discussions
- [ ] 创建欢迎帖（复制上面的模板）
- [ ] 创建 Release（复制上面的模板）
- [ ] 更新仓库URL（已完成）

### 社交媒体发布：

- [ ] Twitter/X 发布
- [ ] 微信公众号发布
- [ ] LinkedIn 发布（可选）

---

## 5. 发布后维护

- 定期查看 Discussions 并回复
- 处理 Issues 和 PR
- 更新文档和示例
- 发布新版本时更新 Release Notes