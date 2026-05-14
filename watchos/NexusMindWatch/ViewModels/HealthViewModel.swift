import Foundation

@MainActor
class HealthViewModel: ObservableObject {
    @Published var isLoading: Bool = false
    @Published var errorMessage: String?

    @Published var overallStatus: String = "unknown"
    @Published var eventLoopLag: Int = 0
    @Published var lastHeartbeat: Int = 0

    @Published var agents: [AgentHealthStatus] = []

    private let apiClient = APIClient.shared

    // MARK: - Computed Properties

    var healthScore: Double {
        guard !agents.isEmpty else { return overallStatus == "healthy" ? 1.0 : 0.0 }

        let healthy = agents.filter { $0.status == "healthy" }.count
        return Double(healthy) / Double(agents.count)
    }

    var healthyAgentPercent: Int {
        guard !agents.isEmpty else { return 100 }
        return Int(Double(agents.filter { $0.status == "healthy" }.count) / Double(agents.count) * 100)
    }

    var lastHeartbeatElapsed: Int {
        return Int(Date().timeIntervalSince1970 * 1000) - lastHeartbeat
    }

    var lastHeartbeatTime: String {
        let elapsed = lastHeartbeatElapsed
        if elapsed < 1000 {
            return "刚刚"
        } else if elapsed < 60000 {
            return "\(elapsed / 1000)秒前"
        } else {
            return "\(elapsed / 60000)分钟前"
        }
    }

    // MARK: - Data Loading

    func refresh() async {
        isLoading = true
        errorMessage = nil

        do {
            let summary = try await apiClient.getSummary()

            overallStatus = summary.sentinel.status
            eventLoopLag = summary.sentinel.eventLoopLag
            lastHeartbeat = summary.sentinel.lastBeat

            agents = try await apiClient.getAgents()

        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}