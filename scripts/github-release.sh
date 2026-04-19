#!/bin/bash

# ColoBot GitHub 自动化发布脚本
# 使用方法: ./scripts/github-release.sh

set -e

# 配置（从环境变量读取，不要硬编码）
GITHUB_TOKEN="${GITHUB_TOKEN:-}"
GITHUB_REPO="${GITHUB_REPO:-}"  # 格式: owner/repo
VERSION="${VERSION:-v0.1.0}"

# 检查环境变量
if [ -z "$GITHUB_TOKEN" ]; then
    echo "❌ 错误: 请设置 GITHUB_TOKEN 环境变量"
    echo "   export GITHUB_TOKEN=your_token_here"
    exit 1
fi

if [ -z "$GITHUB_REPO" ]; then
    echo "❌ 错误: 请设置 GITHUB_REPO 环境变量"
    echo "   export GITHUB_REPO=owner/repo"
    exit 1
fi

echo "🚀 准备发布 ColoBot $VERSION 到 $GITHUB_REPO"

# 创建 Release
echo "📦 创建 GitHub Release..."

RELEASE_BODY=$(cat <<'EOF'
# ColoBot v0.1.0 - 首个开源版本 🎉

## 🌟 项目简介

ColoBot 是一个开源的 AI 智能体协作平台，支持多模态输入输出、Skill 编排、自动审批流程和飞书集成。

### 核心特性

- 🧠 **父子智能体协作** - 父Agent创建子Agent处理子任务，TTL自动过期
- 📝 **Skill 编排** - Markdown格式定义，触发词激活
- ⚖️ **四层审批漏斗** - Tirith规则 → Pattern历史 → 用户行为 → Smart LLM
- 💾 **向量记忆检索** - pgvector驱动的语义搜索
- 📱 **飞书集成** - 交互式卡片 + 快捷审批按钮
- 🌐 **多LLM支持** - OpenAI / Anthropic / MiniMax + Fallback链

## 📦 安装

```bash
# 克隆项目
git clone https://github.com/OWNER/REPO.git
cd colobot

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env

# 启动数据库
docker compose up -d postgres

# 初始化数据库
npm run db:init

# 启动服务
npm run dev
```

## 📚 文档

- [完整文档](./README.md)
- [API参考](./docs/api-reference.md)
- [使用示例](./docs/examples.md)
- [贡献指南](./CONTRIBUTING.md)

## 🤝 贡献

我们欢迎所有形式的贡献！

- 🐛 [报告Bug](../../issues/new?template=bug_report.md)
- 💡 [功能建议](../../issues/new?template=feature_request.md)
- 📖 改进文档
- 💻 贡献代码

## 📜 许可证

本项目采用 [Apache 2.0](./LICENSE) 许可证。

## 🙏 致谢

感谢所有为这个项目做出贡献的人！
EOF
)

# 使用 GitHub API 创建 Release
RESPONSE=$(curl -s -X POST \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer $GITHUB_TOKEN" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    https://api.github.com/repos/$GITHUB_REPO/releases \
    -d "{
        \"tag_name\": \"$VERSION\",
        \"target_commitish\": \"master\",
        \"name\": \"ColoBot $VERSION - 首个开源版本 🎉\",
        \"body\": $(echo "$RELEASE_BODY" | jq -Rs .),
        \"draft\": false,
        \"prerelease\": false,
        \"generate_release_notes\": false
    }")

# 检查是否成功
if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    RELEASE_URL=$(echo "$RESPONSE" | jq -r '.html_url')
    echo "✅ Release 创建成功！"
    echo "   URL: $RELEASE_URL"
else
    echo "❌ Release 创建失败"
    echo "$RESPONSE" | jq '.'
    exit 1
fi

echo ""
echo "🎉 发布完成！"
echo ""
echo "接下来你可以："
echo "1. 在社交媒体分享 Release 链接"
echo "2. 启用 GitHub Discussions"
echo "3. 创建欢迎帖"
echo ""
echo "参考文档: docs/community-guide.md"