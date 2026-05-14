import SwiftUI

struct ContentView: View {
    @State private var selectedTab = 0

    var body: some View {
        TabView(selection: $selectedTab) {
            SecurityView()
                .tabItem {
                    Image(systemName: "shield.fill")
                    Text("安全")
                }
                .tag(0)

            HealthDashboardView()
                .tabItem {
                    Image(systemName: "heart.fill")
                    Text("健康")
                }
                .tag(1)

            QuickCommandsView()
                .tabItem {
                    Image(systemName: "bolt.fill")
                    Text("指令")
                }
                .tag(2)
        }
        .onReceive(NotificationCenter.default.publisher(for: .securityAlert)) { _ in
            selectedTab = 0
        }
        .onReceive(NotificationCenter.default.publisher(for: .refreshHealthStatus)) { _ in
            selectedTab = 1
        }
    }
}

#Preview {
    ContentView()
}