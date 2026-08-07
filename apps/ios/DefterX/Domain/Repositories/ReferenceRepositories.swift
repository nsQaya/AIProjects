import Foundation
protocol BookRepository: Sendable { func list() async throws -> [Book] }
protocol AccountRepository: Sendable { func list(bookId: UUID) async throws -> [Account] }
protocol CategoryRepository: Sendable { func list(bookId: UUID) async throws -> [Category] }
protocol ContactRepository: Sendable { func list(bookId: UUID) async throws -> [Contact] }

