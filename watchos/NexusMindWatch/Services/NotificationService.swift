import Foundation
import UserNotifications

class NotificationDelegate: NSObject, UNUserNotificationCenterDelegate {
    static let shared = NotificationDelegate()

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        if let type = userInfo["type"] as? String {
            switch type {
            case "security_alert":
                NotificationCenter.default.post(name: .securityAlert, object: userInfo)
            case "session_timeout":
                NotificationCenter.default.post(name: .sessionTimeout, object: userInfo)
            case "agent_dead":
                NotificationCenter.default.post(name: .refreshHealthStatus, object: nil)
            default:
                break
            }
        }

        completionHandler()
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // 即使在前台也显示通知
        completionHandler([.banner, .sound])
    }
}