# ColoBot 桌面应用规划

## 背景

当前 ColoBot 以 Docker 和 Web 形式部署，适合技术用户。普通用户需要更简单的使用方式。

桌面应用可以：
- 本地运行，数据完全私有
- 无需服务器配置
- 系统托盘常驻
- 原生文件系统访问

---

## 技术方案对比

| 方案 | 包体大小 | 内存占用 | 开发成本 | 生态成熟度 |
|------|----------|----------|----------|------------|
| Electron | ~150MB | ~100MB | 低 | ⭐⭐⭐⭐⭐ |
| Tauri | ~10MB | ~30MB | 中 | ⭐⭐⭐⭐ |
| Neutralino | ~5MB | ~20MB | 中 | ⭐⭐⭐ |
| NW.js | ~100MB | ~80MB | 低 | ⭐⭐⭐ |

### 推荐：Tauri

**理由**：
1. 包体小（~10MB vs Electron ~150MB）
2. 内存占用低
3. 安全性高（Rust 后端）
4. 前端可复用现有 Vue 3 代码
5. 跨平台支持（Windows/macOS/Linux）

**劣势**：
- 需要 Rust 开发（学习成本）
- 生态不如 Electron 成熟

---

## 架构设计

```
┌─────────────────────────────────────────┐
│              Tauri 应用                   │
├─────────────────────────────────────────┤
│  前端 (Vue 3)                            │
│  - 复用 packages/frontend                │
│  - 适配桌面 UI                           │
├─────────────────────────────────────────┤
│  后端 (Rust + Node.js)                   │
│  - Tauri Commands (Rust)                 │
│  - @colobot/core (Node.js via sidecar)   │
│  - 本地存储 (SQLite)                     │
├─────────────────────────────────────────┤
│  系统集成                                │
│  - 系统托盘                              │
│  - 开机自启                              │
│  - 文件关联                              │
│  - 通知系统                              │
└─────────────────────────────────────────┘
```

---

## 功能规划

### Phase 1: 基础框架 (v0.5.0)

**目标**：可运行的桌面应用

**任务**：
- [ ] 初始化 Tauri 项目
- [ ] 集成 Vue 3 前端
- [ ] 配置系统托盘
- [ ] 实现窗口管理（主窗口、设置窗口）
- [ ] 本地数据存储路径

### Phase 2: 核心功能 (v0.6.0)

**目标**：核心功能可用

**任务**：
- [ ] 对话功能（连接本地 LLM）
- [ ] Charter 许可证管理
- [ ] Sentinel 安全守护
- [ ] 本地配置持久化
- [ ] 日志查看器

### Phase 3: 系统集成 (v0.7.0)

**目标**：深度系统集成

**任务**：
- [ ] 开机自启动
- [ ] 系统通知
- [ ] 快捷键全局热键
- [ ] 文件拖放支持
- [ ] 右键菜单集成

### Phase 4: 优化发布 (v0.8.0)

**目标**：生产就绪

**任务**：
- [ ] 自动更新机制
- [ ] 安装包优化
- [ ] 性能优化
- [ ] 多平台测试
- [ ] 签名公证（macOS/Windows）

---

## 技术细节

### 1. 前端适配

现有前端需要调整：

```typescript
// 检测运行环境
const isDesktop = window.__TAURI__ !== undefined

// API 调用方式
if (isDesktop) {
  // 使用 Tauri Commands
  const result = await invoke('charter_list')
} else {
  // 使用 HTTP API
  const result = await charterApi.list()
}
```

### 2. 后端集成

两种方案：

**方案 A：纯 Rust**
- 重写核心逻辑到 Rust
- 性能最优
- 工作量大

**方案 B：Rust + Node.js Sidecar**
- Rust 处理系统集成
- Node.js sidecar 运行 @colobot/core
- 复用现有代码
- 推荐方案

```rust
// Tauri Command 示例
#[tauri::command]
async fn charter_apply(type: String, reason: String) -> Result<Charter, String> {
    // 调用 Node.js sidecar
    let output = Command::new_sidecar("colobot-core")
        .args(["charter", "apply", &type, &reason])
        .output()
        .await
        .map_err(|e| e.to_string())?;
    
    // 解析结果
    parse_charter_result(&output.stdout)
}
```

### 3. 数据存储

```
~/.colobot/
├── config.json      # 配置
├── data.db          # SQLite 数据库
├── logs/            # 日志
│   └── app.log
└── cache/           # 缓存
```

### 4. 系统托盘

```rust
SystemTray::new()
  .with_menu(
    SystemTrayMenu::new()
      .add_item(CustomMenuItem::new("show", "显示主窗口"))
      .add_item(CustomMenuItem::new("settings", "设置"))
      .add_native_item(SystemTrayMenuItem::Separator)
      .add_item(CustomMenuItem::new("quit", "退出"))
  )
```

---

## 打包发布

### macOS

```bash
# 构建
cargo tauri build --target universal-apple-darwin

# 公证
xcrun notarytool submit target/release/bundle/macos/ColoBot.app
```

### Windows

```bash
# 构建
cargo tauri build

# 签名
signtool sign target/release/bundle/msi/ColoBot_0.5.0_x64.msi
```

### Linux

```bash
# 构建
cargo tauri build

# 生成 AppImage/deb/rpm
```

---

## 依赖关系

```
@colobot/desktop (Tauri)
├── packages/frontend (Vue 3)
├── packages/core (Node.js sidecar)
├── packages/charter
├── packages/sentinel
└── packages/types
```

---

## 时间估算

| Phase | 工作量 | 说明 |
|-------|--------|------|
| Phase 1 | 2-3 天 | Tauri 初始化 + 基础配置 |
| Phase 2 | 5-7 天 | 核心功能集成 |
| Phase 3 | 3-5 天 | 系统集成 |
| Phase 4 | 3-5 天 | 优化发布 |
| **总计** | **13-20 天** | |

---

## 风险

1. **Rust 学习曲线** - 团队不熟悉 Rust
   - 缓解：使用 Node.js sidecar，最小化 Rust 代码

2. **跨平台兼容** - 不同系统行为差异
   - 缓解：充分测试，使用 Tauri 抽象层

3. **包体大小** - Node.js sidecar 增加体积
   - 缓解：压缩、按需加载

---

## 下一步

1. 安装 Tauri CLI：`cargo install tauri-cli`
2. 初始化项目：`cargo tauri init`
3. 配置前端集成
4. 实现系统托盘
