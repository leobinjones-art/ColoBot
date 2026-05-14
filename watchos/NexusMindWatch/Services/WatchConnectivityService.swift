import Foundation
import WatchConnectivity

class WatchConnectivityService: NSObject, ObservableObject {
    static let shared = WatchConnectivityService()

    @Published var isConnected: Bool = false
    @Published var apiToken: String? {
        didSet {
            if let token = apiToken {
                UserDefaults.standard.set(token, forKey: "apiToken")
                APIClient.shared.apiToken = token
            }
        }
    }
    @Published var serverURL: URL? {
        didSet {
            if let url = serverURL {
                UserDefaults.standard.set(url.absoluteString, forKey: "serverURL")
                APIClient.shared.baseURL = url
            }
        }
    }

    private override init() {
        super.init()
        loadSavedConfig()
    }

    private func loadSavedConfig() {
        if let token = UserDefaults.standard.string(forKey: "apiToken") {
            apiToken = token
            APIClient.shared.apiToken = token
        }
        if let urlString = UserDefaults.standard.string(forKey: "serverURL"),
           let url = URL(string: urlString) {
            serverURL = url
            APIClient.shared.baseURL = url
        }
    }

    func start() {
        guard WCSession.isSupported() else { return }

        let session = WCSession.default
        session.delegate = self
        session.activate()
    }

    func requestConfiguration() {
        guard WCSession.default.activationState == .activated else { return }

        WCSession.default.sendMessage(
            ["request": "configuration"],
            replyHandler: { response in
                DispatchQueue.main.async {
                    if let token = response["apiToken"] as? String {
                        self.apiToken = token
                    }
                    if let serverURLString = response["serverURL"] as? String {
                        self.serverURL = URL(string: serverURLString)
                    }
                }
            },
            errorHandler: { error in
                print("[WatchConnectivity] Error: \(error.localizedDescription)")
            }
        )
    }
}

extension WatchConnectivityService: WCSessionDelegate {
    func session(_ session: WCSession, activationDidCompleteWith state: WCSessionActivationState, error: Error?) {
        DispatchQueue.main.async {
            self.isConnected = state == .activated

            if state == .activated {
                // 首次连接时请求配置
                self.requestConfiguration()
            }
        }
    }

    func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
        guard let type = message["type"] as? String else { return }

        DispatchQueue.main.async {
            switch type {
            case "configurationUpdate":
                self.handleConfigurationUpdate(message)
            case "securityAlert":
                NotificationCenter.default.post(name: .securityAlert, object: message)
            case "sessionTimeout":
                NotificationCenter.default.post(name: .sessionTimeout, object: message)
            default:
                break
            }
        }
    }

    private func handleConfigurationUpdate(_ message: [String: Any]) {
        if let token = message["apiToken"] as? String {
            apiToken = token
        }
        if let urlString = message["serverURL"] as? String {
            serverURL = URL(string: urlString)
        }
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let securityAlert = Notification.Name("securityAlert")
    static let sessionTimeout = Notification.Name("sessionTimeout")
    static let refreshHealthStatus = Notification.Name("refreshHealthStatus")
}