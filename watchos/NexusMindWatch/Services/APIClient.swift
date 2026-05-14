import Foundation

class APIClient: ObservableObject {
    static let shared = APIClient()

    @Published var baseURL: URL
    @Published var apiToken: String?

    private let session: URLSession
    private let decoder: JSONDecoder

    init() {
        self.session = URLSession.shared
        self.decoder = JSONDecoder()

        // 默认 URL，可通过 WatchConnectivity 配置
        self.baseURL = URL(string: "http://localhost:3000")!
        self.apiToken = UserDefaults.standard.string(forKey: "apiToken")
    }

    // MARK: - GET Request

    func get<T: Codable>(_ endpoint: String) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint))

        if let token = apiToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard httpResponse.statusCode == 200 else {
            throw APIError.httpError(httpResponse.statusCode)
        }

        let wrapper = try decoder.decode(APIResponse<T>.self, from: data)

        guard wrapper.code == 200 else {
            throw APIError.apiError(wrapper.code, wrapper.msg)
        }

        return wrapper.data
    }

    // MARK: - POST Request

    func post<T: Codable, U: Encodable>(_ endpoint: String, body: U) async throws -> T {
        var request = URLRequest(url: baseURL.appendingPathComponent(endpoint))
        request.httpMethod = "POST"

        if let token = apiToken {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let encoder = JSONEncoder()
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        let wrapper = try decoder.decode(APIResponse<T>.self, from: data)

        guard wrapper.code == 200 else {
            throw APIError.apiError(wrapper.code, wrapper.msg)
        }

        return wrapper.data
    }

    // MARK: - Convenience Methods

    func getSummary() async throws -> WatchSummary {
        return try await get("/api/v1/watch/summary")
    }

    func getAgents() async throws -> [AgentHealthStatus] {
        return try await get("/api/v1/watch/agents")
    }

    func getSessions() async throws -> [WatchSessionState] {
        return try await get("/api/v1/watch/sessions")
    }

    func executeCommand(id: String) async throws -> CommandResult {
        return try await post("/api/v1/watch/command/\(id)", body: EmptyBody())
    }

    func sessionAction(sessionId: String, action: String) async throws -> CommandResult {
        return try await post("/api/v1/watch/sessions/\(sessionId)/action", body: ActionBody(action: action))
    }

    struct EmptyBody: Encodable {}
    struct ActionBody: Encodable {
        let action: String
    }
}

// MARK: - Errors

enum APIError: Error, LocalizedError {
    case invalidResponse
    case httpError(Int)
    case apiError(Int, String?)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidResponse:
            return "无效响应"
        case .httpError(let code):
            return "HTTP错误: \(code)"
        case .apiError(let code, let msg):
            return "API错误 \(code): \(msg ?? "未知")"
        case .decodingError(let error):
            return "解析错误: \(error.localizedDescription)"
        }
    }
}