import Foundation

// MARK: - Sentinel 健康状态

struct SentinelHealthStatus: Codable {
    let status: String // "healthy" | "degraded" | "dead"
    let eventLoopLag: Int // milliseconds
    let lastBeat: Int // timestamp
}

// MARK: - Sentinel 运行状态

struct SentinelStatus: Codable {
    let enabled: Bool
    let mode: String // "active" | "standby" | "disabled"
    let healthStatus: SentinelHealthStatus
    let activeSessions: Int
    let blockedToday: Int
    let lastAlert: Int?
}

// MARK: - Agent 健康状态

struct AgentHealthStatus: Codable, Identifiable {
    let id: String
    let name: String?
    let status: String // "healthy" | "unhealthy" | "dead"
    let lastHeartbeat: Int
    let missedBeats: Int
    let sessionCount: Int
    let avgResponseTime: Double?
}

// MARK: - Watch 会话状态

struct WatchSessionState: Codable, Identifiable {
    let id: String // sessionId
    let agentId: String
    let agentName: String?
    let status: String // "idle" | "processing" | "blocked" | "error"
    let currentTask: String?
    let taskProgress: Int // 0-100
    let lastActivity: Int
    let timeoutStage: String? // "normal" | "warning" | "prompt" | "takeover"
}

// MARK: - 快捷指令

struct QuickCommand: Codable, Identifiable {
    let id: String
    let name: String
    let icon: String
    let action: String
    let confirmation: Bool
}

// MARK: - Watch 仪表盘摘要

struct WatchSummary: Codable {
    let sentinel: SentinelInfo
    let agents: AgentsInfo
    let sessions: SessionsInfo
    let quickCommands: [QuickCommand]

    struct SentinelInfo: Codable {
        let status: String
        let eventLoopLag: Int
        let lastBeat: Int
    }

    struct AgentsInfo: Codable {
        let total: Int
        let healthy: Int
        let unhealthy: Int
    }

    struct SessionsInfo: Codable {
        let active: Int
        let warning: Int
        let takeover: Int
    }
}

// MARK: - API Response

struct APIResponse<T: Codable>: Codable {
    let code: Int
    let data: T
    let msg: String?
}

// MARK: - Command Result

struct CommandResult: Codable {
    let success: Bool
    let message: String?
}