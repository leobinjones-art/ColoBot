import Foundation

@MainActor
class SecurityViewModel: ObservableObject {
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    @Published var status: String = "unknown"
    @Published var eventLoopLag: Int = 0
    @Published var lastBeat: Int = 0

    @Published var totalAgents: Int = 0
    @Published var healthyAgents: Int = 0
    @Published var unhealthyAgents: Int = 0

    @Published var activeSessions: Int = 0
    @Published var warningSessions: Int = 0
    @Published var takeoverSessions: Int = 0

    @Published var agents: [AgentHealthStatus] = []
    @Published var sessions: [WatchSessionState] = []
    @Published var quickCommands: [QuickCommand] = []

    private let apiClient = APIClient.shared
    private var updateTask: Task<Void, Never>?

    // MARK: - Computed Properties

    var isHealthy: Bool {
        return status == "healthy"
    }

    var healthScore: Double {
        guard totalAgents > 0 else { return 1.0 }
        return Double(healthyAgents) / Double(totalAgents)
    }

    // MARK: - Data Loading

    func refresh() async {
        isLoading = true
        errorMessage = nil

        do {
            let summary = try await apiClient.getSummary()

            status = summary.sentinel.status
            eventLoopLag = summary.sentinel.eventLoopLag
            lastBeat = summary.sentinel.lastBeat

            totalAgents = summary.agents.total
            healthyAgents = summary.agents.healthy
            unhealthyAgents = summary.agents.unhealthy

            activeSessions = summary.sessions.active
            warningSessions = summary.sessions.warning
            takeoverSessions = summary.sessions.takeover

            quickCommands = summary.quickCommands

            // 并行加载 agents 和 sessions
            async let agentsTask = apiClient.getAgents()
            async let sessionsTask = apiClient.getSessions()

            agents = try await agentsTask
            sessions = try await sessionsTask

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    // MARK: - Monitoring

    func startMonitoring(interval: TimeInterval = 30) {
        stopMonitoring()

        updateTask = Task {
            while !Task.isCancelled {
                await refresh()

                do {
                    try await Task.sleep(nanoseconds: UInt64(interval * 1_000_000_000))
                } catch {
                    break
                }
            }
        }
    }

    func stopMonitoring() {
        updateTask?.cancel()
        updateTask = nil
    }

    // MARK: - Commands

    func executeCommand(_ command: QuickCommand) async -> Bool {
        do {
            let result = try await apiClient.executeCommand(id: command.id)
            await refresh()
            return result.success
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }

    func terminateSession(_ session: WatchSessionState) async -> Bool {
        do {
            let result = try await apiClient.sessionAction(sessionId: session.id, action: "terminate")
            await refresh()
            return result.success
        } catch {
            errorMessage = error.localizedDescription
            return false
        }
    }
}