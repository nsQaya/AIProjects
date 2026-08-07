import Foundation

enum Configuration {
    static var apiBaseURL: URL {
        if let value = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           let url = URL(string: value) { return url }
        return URL(string: "http://127.0.0.1:8787/api/v1")!
    }
    static var displayName: String {
        (Bundle.main.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String) ?? "Finance"
    }
    static let backgroundTaskIdentifier = "com.example.defterx.sync"
}

