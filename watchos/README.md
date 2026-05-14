# NexusMind Watch

Apple Watch 前端应用，用于监控 NexusMind 安全系统状态。

## 功能

- **安全监控**: 实时查看 Sentinel 安全状态、活跃会话、Agent 健康
- **健康仪表盘**: 系统健康度环形图、Event Loop 延迟、心跳监控
- **快捷指令**: 暂停/恢复会话、紧急停止、刷新状态
- **表盘组件**: 在 Watch Face 显示安全状态

## 项目结构

```
NexusMindWatch/
├── NexusMindWatchApp.swift          # App 入口
├── Models/
│   └── Models.swift                 # 数据模型
├── Services/
│   ├── APIClient.swift              # HTTP 客户端
│   ├── WatchConnectivityService.swift # iOS 配对
│   └── NotificationService.swift    # 通知处理
├── ViewModels/
│   ├── SecurityViewModel.swift      # 安全监控 VM
│   └── HealthViewModel.swift        # 健康仪表盘 VM
├── Views/
│   ├── ContentView.swift            # 主 TabView
│   ├── SecurityView.swift           # 安全监控
│   ├── HealthDashboardView.swift    # 健康仪表盘
│   └── QuickCommandsView.swift      # 快捷指令
├── Complication/
│   └── ComplicationController.swift # 表盘组件
└── Info.plist                       # 配置文件
```

## 使用

1. 在 Xcode 中创建 watchOS App 项目
2. 将上述文件导入项目
3. 配置 API URL (默认 localhost:3000)
4. 运行并测试

## API Endpoints

| Endpoint | 说明 |
|----------|------|
| `/api/v1/watch/summary` | 仪表盘摘要 |
| `/api/v1/watch/agents` | Agent 健康列表 |
| `/api/v1/watch/sessions` | 活跃会话 |
| `/api/v1/watch/command/:id` | 执行快捷指令 |

## 配置

通过 WatchConnectivity 与 iOS App 配对获取:
- API Token
- Server URL

或直接在 UserDefaults 配置:
```swift
UserDefaults.standard.set("your-token", forKey: "apiToken")
UserDefaults.standard.set("http://your-server:3000", forKey: "serverURL")
```