import SwiftUI

@main
struct NexusMindWatchApp: App {
    @WKApplicationDelegateAdaptor private var appDelegate: AppDelegate

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(SecurityViewModel())
                .environmentObject(HealthViewModel())
        }
    }
}

class AppDelegate: NSObject, WKApplicationDelegate {
    func applicationDidFinishLaunching() {
        // 初始化通知
        UNUserNotificationCenter.current().delegate = NotificationDelegate.shared
        WatchConnectivityService.shared.start()
    }
}