import SwiftUI

struct SecurityView: View {
    @StateObject private var viewModel = SecurityViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 12) {
                // 状态卡片
                StatusCard(
                    status: viewModel.status,
                    title: viewModel.isHealthy ? "运行正常" : "需要关注",
                    subtitle: "安全守护 \(viewModel.status) 模式"
                )

                // 统计网格
                HStack(spacing: 8) {
                    StatBox(value: viewModel.activeSessions, label: "活跃会话")
                    StatBox(value: viewModel.warningSessions, label: "警告")
                }

                HStack(spacing: 8) {
                    StatBox(value: viewModel.totalAgents, label: "Agent总数")
                    StatBox(value: viewModel.unhealthyAgents, label: "异常")
                }

                // Agent 列表
                if !viewModel.agents.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Agent 状态")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        ForEach(viewModel.agents) { agent in
                            AgentRow(agent: agent)
                        }
                    }
                }

                // 错误信息
                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                        .padding()
                }
            }
            .padding()
        }
        .navigationTitle("安全监控")
        .refreshable {
            await viewModel.refresh()
        }
        .onAppear {
            viewModel.startMonitoring()
        }
        .onDisappear {
            viewModel.stopMonitoring()
        }
    }
}

// MARK: - Components

struct StatusCard: View {
    let status: String
    let title: String
    let subtitle: String

    var body: some View {
        VStack(spacing: 8) {
            HStack {
                Circle()
                    .fill(statusColor)
                    .frame(width: 12, height: 12)

                Text(title)
                    .font(.headline)

                Spacer()
            }

            Text(subtitle)
                .font(.caption)
                .foregroundColor(.secondary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(12)
    }

    private var statusColor: Color {
        switch status {
        case "healthy": return .green
        case "degraded": return .orange
        case "dead": return .red
        default: return .gray
        }
    }
}

struct StatBox: View {
    let value: Int
    let label: String

    var body: some View {
        VStack {
            Text("\(value)")
                .font(.title2)
                .fontWeight(.bold)

            Text(label)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}

struct AgentRow: View {
    let agent: AgentHealthStatus

    var body: some View {
        HStack {
            Circle()
                .fill(agent.status == "healthy" ? Color.green : Color.red)
                .frame(width: 8, height: 8)

            Text(agent.id)
                .font(.caption)
                .lineLimit(1)

            Spacer()

            Text(agent.status)
                .font(.caption2)
                .foregroundColor(.secondary)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    SecurityView()
}