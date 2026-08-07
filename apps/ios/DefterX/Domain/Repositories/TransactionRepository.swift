import Foundation
protocol TransactionRepository: Sendable {
    func createOffline(_ transaction: FinanceTransaction) async throws
    func recent(bookId: UUID, limit: Int) async throws -> [FinanceTransaction]
    func pendingOperations(limit: Int) async throws -> [SyncOperation]
    func setOperation(_ operationId: UUID, state: SyncState, message: String?) async throws
    func syncCursor(bookId: UUID) async throws -> String
    func applyServerChanges(_ changes: [SyncChange], cursor: String, bookId: UUID) async throws
}
struct SyncOperation: Codable, Sendable { let operationId: UUID; let entity: String; let action: String; let payload: FinanceTransaction }
struct SyncChange: Codable, Sendable { let cursor: String; let entityType: String; let entityId: UUID; let action: String; let version: Int; let payload: ServerTransaction }
