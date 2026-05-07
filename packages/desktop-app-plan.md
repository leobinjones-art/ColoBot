# NexusMind 桌面应用规划

## 背景

提供原生安装包给消费者，开发者使用 npm 包。

**目标用户**：

- **消费者**：下载安装包，安装即用，通过应用内配置向导设置
- **开发者**：`npm install @nexusmind/core`，代码集成或 CLI 使用

**分发方式**：
| 用户类型 | 分发方式 | 说明 |
|----------|----------|------|
| 消费者 | 原生安装包 | .dmg / .exe / .AppImage |
| 开发者 | npm 包 | @nexusmind/core, @nexusmind/charter 等 |
| CI/CD | Docker | 仅用于构建和测试，不作为分发 |

**消费者体验**：

1. 下载安装包
2. 双击安装
3. 打开应用，完成配置向导
4. 开始使用

**开发者体验**：

1. `npm install @nexusmind/core`
2. 代码中引入或使用 CLI
3. 配置通过环境变量或代码

**版本策略**：

- 消费者：跟随桌面应用版本号（v0.5.0, v0.6.0...）
- 开发者：npm 稳定版，语义化版本（0.4.0, 0.5.0...），经过充分测试

---

## 发布形式

| 平台    | 格式            | 大小预估 |
| ------- | --------------- | -------- |
| macOS   | .dmg, .app      | ~50MB    |
| Windows | .exe, .msi      | ~60MB    |
| Linux   | .AppImage, .deb | ~45MB    |

---

## 技术方案对比

| 方案       | 包体大小 | 内存占用 | 开发成本 | 生态成熟度 |
| ---------- | -------- | -------- | -------- | ---------- |
| Electron   | ~150MB   | ~100MB   | 低       | ⭐⭐⭐⭐⭐ |
| Tauri      | ~10MB    | ~30MB    | 中       | ⭐⭐⭐⭐   |
| Neutralino | ~5MB     | ~20MB    | 中       | ⭐⭐⭐     |

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
│  - @nexusmind/core (Node.js via sidecar)   │
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
- Node.js sidecar 运行 @nexusmind/core
- 复用现有代码
- 推荐方案

```rust
// Tauri Command 示例
#[tauri::command]
async fn charter_apply(type: String, reason: String) -> Result<Charter, String> {
    // 调用 Node.js sidecar
    let output = Command::new_sidecar("nexusmind-core")
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
~/.nexusmind/
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
xcrun notarytool submit target/release/bundle/macos/NexusMind.app
```

### Windows

```bash
# 构建
cargo tauri build

# 签名
signtool sign target/release/bundle/msi/NexusMind_0.5.0_x64.msi
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
@nexusmind/desktop (Tauri)
├── packages/frontend (Vue 3)
├── packages/core (Node.js sidecar)
├── packages/charter
├── packages/sentinel
└── packages/types
```

---

## 时间估算

| Phase    | 工作量       | 说明                    |
| -------- | ------------ | ----------------------- |
| Phase 1  | 2-3 天       | Tauri 初始化 + 基础配置 |
| Phase 2  | 5-7 天       | 核心功能集成            |
| Phase 3  | 3-5 天       | 系统集成                |
| Phase 4  | 3-5 天       | 优化发布                |
| **总计** | **13-20 天** |                         |

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
