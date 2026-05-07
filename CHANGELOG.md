# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-05-06

### Added

#### Charter 许可证系统
- **@colobot/charter** - 许可证系统
  - CharterDefinition: 定义 AI 能力边界
  - DocumentLibrary: 提供可追溯的事实来源，防止幻觉
  - 内置许可证: academic, legal, longdoc
  - 内置文档库: academic, legal, general
  - CharterManager: 许可证生命周期管理
  - 扩展系统: 支持社区贡献自定义许可证

#### Sentinel 安全守护
- **@colobot/sentinel** - CharterGuard 集成
  - 能力权限检查
  - 工具权限检查
  - 文档库条目关联
  - SessionTimeoutMonitor: 会话超时监控
  - SelfHeartbeat: 自心跳健康检测

#### Core 核心功能
- 健康检查模块 `/health` 端点
- 优雅关闭模块（SIGTERM/SIGINT 处理）
- 统一错误处理（AppError 分类）
- 配置存储模块（消费者版配置持久化）
- 动态任务分解
- 多 LLM Provider 支持（OpenAI、Anthropic、Mock、Fallback）

#### 前端
- Charter 管理页面
- 命令面板（⌘K）
- 热力图、进度环等可视化组件
- Mock API 服务器

### Changed

- 弃用 SOP (Standard Operating Procedure) 系统
  - 移动到 `_deprecated_sop-base` 和 `_deprecated_sop-academic`
  - Charter 许可证系统替代 SOP 工作流编排
- 统一所有包版本到 0.4.0
- 优化包依赖关系

### Architecture

- **Charter vs SOP**: SOP 是预设工作流，但 AI 本身已具备动态编排能力，故弃用
- **Charter 设计哲学**: 默认最大限制 → 许可证解锁能力 → 文档库防幻觉

### Tests

- 587 tests passing
- Charter: 35 tests
- Sentinel: 142 tests (including CharterGuard tests)
- Core: 200+ tests
