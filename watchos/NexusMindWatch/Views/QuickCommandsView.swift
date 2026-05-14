import SwiftUI

struct QuickCommandsView: View {
    @StateObject private var viewModel = SecurityViewModel()
    @State private var showConfirmation: Bool = false
    @State private var pendingCommand: QuickCommand?

    var body: some View {
        ScrollView {
            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(viewModel.quickCommands) { command in
                    CommandButton(command: command) {
                        if command.confirmation {
                            pendingCommand = command
                            showConfirmation = true
                        } else {
                            Task {
                                _ = await viewModel.executeCommand(command)
                            }
                        }
                    }
                }
            }
            .padding()

            // 活跃会话操作
            if !viewModel.sessions.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("活跃会话")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    ForEach(viewModel.sessions) { session in
                        SessionRow(session: session) {
                            Task {
                                _ = await viewModel.terminateSession(session)
                            }
                        }
                    }
                }
                .padding()
            }
        }
        .navigationTitle("快捷指令")
        .alert("执行指令", isPresented: $showConfirmation) {
            Button("取消", role: .cancel) {
                pendingCommand = nil
            }
            Button("确认") {
                if let command = pendingCommand {
                    Task {
                        _ = await viewModel.executeCommand(command)
                    }
                }
                pendingCommand = nil
            }
        } message: {
            if let command = pendingCommand {
                Text("确定要执行 \(command.name) 吗？")
            }
        }
        .onAppear {
            Task {
                await viewModel.refresh()
            }
        }
    }
}

// MARK: - Components

struct CommandButton: View {
    let command: QuickCommand
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: iconName)
                    .font(.title2)

                Text(command.name)
                    .font(.caption)
                    .lineLimit(1)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 20)
            .background(commandColor.opacity(0.15))
            .cornerRadius(12)
        }
        .buttonStyle(.plain)
    }

    private var iconName: String {
        switch command.action {
        case "pause_all": return "pause.circle.fill"
        case "resume_all": return "play.circle.fill"
        case "terminate_session": return "xmark.circle.fill"
        case "refresh_status": return "arrow.clockwise"
        case "emergency_stop": return "stop.circle.fill"
        default: return "circle.fill"
        }
    }

    private var commandColor: Color {
        switch command.action {
        case "emergency_stop", "terminate_session": return .red
        case "pause_all": return .orange
        case "resume_all": return .green
        default: return .blue
        }
    }
}

struct SessionRow: View {
    let session: WatchSessionState
    let onTerminate: () -> Void

    var body: some View {
        HStack {
            Circle()
                .fill(session.status == "blocked" ? Color.red : Color.green)
                .frame(width: 8, height: 8)

            VStack(alignment: .leading, spacing: 2) {
                Text(session.id.prefix(8))
                    .font(.caption)
                    .fontWeight(.medium)

                Text(session.status)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Button(action: onTerminate) {
                Image(systemName: "xmark.circle")
                    .foregroundColor(.red)
            }
            .buttonStyle(.plain)
        }
        .padding(.vertical, 4)
    }
}

#Preview {
    QuickCommandsView()
}