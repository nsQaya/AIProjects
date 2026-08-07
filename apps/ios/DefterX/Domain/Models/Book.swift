import Foundation
struct Book: Identifiable, Codable, Hashable, Sendable { let id: UUID; var name: String; var bookType: BookType; var baseCurrency: String; var role: BookRole; var version: Int }
enum BookType: String, Codable, CaseIterable, Sendable { case personal = "PERSONAL", business = "BUSINESS", other = "OTHER" }
enum BookRole: String, Codable, Sendable { case owner = "OWNER", admin = "ADMIN", editor = "EDITOR", accountant = "ACCOUNTANT", viewer = "VIEWER" }

