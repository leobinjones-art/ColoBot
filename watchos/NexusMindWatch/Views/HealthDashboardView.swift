import SwiftUI

struct HealthDashboardView: View {
    @StateObject private var viewModel = HealthViewModel()

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // 健康度环形图
                HealthGauge(
                    value: viewModel.healthScore,
                    status: viewModel.overallStatus
                )
                .frame(height: 120)

                // 健康指标
                VStack(spacing: 12) {
                    HealthMetricRow(
                        title: "Event Loop 延迟",
                        value: "\(viewModel.eventLoopLag)ms",
                        isHealthy: viewModel.eventLoopLag < 100
                    )

                    HealthMetricRow(
                        title: "心跳间隔",
                        value: viewModel.lastHeartbeatTime,
                        isHealthy: viewModel.lastHeartbeatElapsed < 5000
                    )

                    HealthMetricRow(
                        title: "Agent 健康率",
                        value: "\(viewModel.healthyAgentPercent)%",
                        isHealthy: viewModel.healthyAgentPercent >= 80
                    )
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(12)

                // Agent 详情
                if !viewModel.agents.isEmpty {
                    DisclosureGroup("Agent 详情") {
                        ForEach(viewModel.agents) { agent in
                            HStack {
                                Circle()
                                    .fill(agent.status == "healthy" ? Color.green : Color.red)
                                    .frame(width: 8, height: 8)

                                Text(agent.id)
                                    .font(.caption)
                                    .lineLimit(1)

                                Spacer()

                                Text("\(agent.missedBeats) missed")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(12)
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
        .navigationTitle("系统健康")
        .refreshable {
            await viewModel.refresh()
        }
        .onAppear {
            Task {
                await viewModel.refresh()
            }
        }
    }
}

// MARK: - Components

struct HealthGauge: View {
    let value: Double // 0-1
    let status: String

    var body: some View {
        ZStack {
            Circle()
                .stroke(Color.gray.opacity(0.2), lineWidth: 12)

            Circle()
                .trim(from: 0, to: value)
                .stroke(gaugeColor, style: StrokeStyle(lineWidth: 12, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .animation(.easeInOut, value: value)

            VStack {
                Text("\(Int(value * 100))")
                    .font(.system(size: 36, weight: .bold, design: .rounded))

                Text(statusText)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }

    private var gaugeColor: Color {
        if value >= 0.8 { return .green }
        if value >= 0.5 { return .orange }
        return .red
    }

    private var statusText: String {
        switch status {
        case "healthy": return "健康"
        case "degraded": return "降级"
        case "dead": return "异常"
        default: return "未知"
        }
    }
}

struct HealthMetricRow: View {
    let title: String
    let value: String
    let isHealthy: Bool

    var body: some View {
        HStack {
            Text(title)
                .font(.caption)

            Spacer()

            HStack(spacing: 4) {
                Circle()
                    .fill(isHealthy ? Color.green : Color.orange)
                    .frame(width: 6, height: 6)

                Text(value)
                    .font(.caption)
                    .fontWeight(.medium)
            }
        }
    }
}

#Preview {
    HealthDashboardView()
}