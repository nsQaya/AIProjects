import Foundation
struct Category: Identifiable, Codable, Hashable, Sendable { let id: UUID; let bookId: UUID; let parentId: UUID?; var name: String; var categoryType: CategoryType; var icon: String?; var isActive: Bool; var version: Int }
enum CategoryType: String, Codable, Sendable { case income="INCOME",expense="EXPENSE" }

