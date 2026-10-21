// The lock screen feed from Pulse (`GET /api/widget`, see lib/widget.ts) and the client that fetches it.
// Shared by the app and the widget extension.

import Foundation

struct Feed: Codable {
    struct Weather: Codable {
        let temp: Int
        let feels: Int
        let code: Int
        let isDay: Bool
        let icon: String
        let label: String
        let hi: Int
        let lo: Int
        let rainAt: Date?
        let rainPop: Int?
        let tip: String?
    }

    struct Recovery: Codable {
        let score: Int
        let band: String
    }

    struct Event: Codable, Identifiable {
        let id: String
        let title: String
        let start: Date
        let end: Date
        let leaveAt: Date?
        let place: String?
        let kind: String // "class" | "shift" | "event"

        enum CodingKeys: String, CodingKey {
            case id, title, start, end, leaveAt, kind
            case place = "where"
        }
    }

    struct Due: Codable {
        let title: String
        let due: Date
        let course: String?
        let weight: Double?
    }

    struct Study: Codable {
        let title: String
        let start: Date
        let end: Date
    }

    struct Alert: Codable {
        let title: String
        let detail: String
        let distanceKm: Int
    }

    struct Line: Codable {
        let icon: String
        let text: String
        let kind: String
    }

    let v: Int
    let generatedAt: Date
    let tz: String
    let weather: Weather?
    let recovery: Recovery?
    let events: [Event]
    let due: [Due]
    let study: Study?
    let alert: Alert?
    let lines: [Line]

    var timeZone: TimeZone { TimeZone(identifier: tz) ?? .current }
}

extension JSONDecoder {
    /// Pulse sends every time as UTC ISO-8601 with milliseconds ("2026-10-22T03:00:00.000Z").
    static let pulse: JSONDecoder = {
        let decoder = JSONDecoder()
        let withMs = ISO8601DateFormatter()
        withMs.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let plain = ISO8601DateFormatter()
        plain.formatOptions = [.withInternetDateTime]
        decoder.dateDecodingStrategy = .custom { dec in
            let s = try dec.singleValueContainer().decode(String.self)
            if let d = withMs.date(from: s) ?? plain.date(from: s) { return d }
            throw DecodingError.dataCorrupted(.init(codingPath: dec.codingPath, debugDescription: "Unreadable date: \(s)"))
        }
        return decoder
    }()
}

/// Host and token are baked into Info.plist at build time from Config.xcconfig.
enum PulseConfig {
    static var host: String { (Bundle.main.object(forInfoDictionaryKey: "PulseHost") as? String ?? "").trimmingCharacters(in: .whitespaces) }
    static var token: String { (Bundle.main.object(forInfoDictionaryKey: "PulseToken") as? String ?? "").trimmingCharacters(in: .whitespaces) }
    static var baseURL: URL? { host.isEmpty ? nil : URL(string: "https://\(host)") }
    static var isConfigured: Bool { baseURL != nil && !token.isEmpty }
}

enum PulseClient {
    private static let cacheKey = "pulse.feed.v1"

    /// Fetches a fresh feed and caches it, so the widget still has something if the next fetch fails.
    static func fetch() async throws -> Feed {
        guard let base = PulseConfig.baseURL, PulseConfig.isConfigured else { throw URLError(.userAuthenticationRequired) }
        var req = URLRequest(url: base.appendingPathComponent("api/widget"))
        req.setValue("Bearer \(PulseConfig.token)", forHTTPHeaderField: "Authorization")
        req.cachePolicy = .reloadIgnoringLocalCacheData
        req.timeoutInterval = 20
        let (data, response) = try await URLSession.shared.data(for: req)
        guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
        let feed = try JSONDecoder.pulse.decode(Feed.self, from: data)
        UserDefaults.standard.set(data, forKey: cacheKey)
        return feed
    }

    static func cached() -> Feed? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return nil }
        return try? JSONDecoder.pulse.decode(Feed.self, from: data)
    }

    /// Fresh if possible, otherwise the last good copy.
    static func latest() async -> Feed? {
        if let fresh = try? await fetch() { return fresh }
        return cached()
    }
}
