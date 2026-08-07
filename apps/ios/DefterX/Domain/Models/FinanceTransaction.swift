import Foundation

struct FinanceTransaction: Identifiable, Codable, Hashable, Sendable {
    let id: UUID; let bookId: UUID; var type: TransactionType; var title: String; var amount: Money
    var currencyCode: String; var accountId: UUID; var targetAccountId: UUID?; var categoryId: UUID?
    var contactId: UUID?; var transactionDate: Date; var dueDate: Date?; var details: String?
    let clientOperationId: UUID; var serverVersion: Int?; var syncState: SyncState
}
enum TransactionType: String, Codable, CaseIterable, Sendable { case income="INCOME",expense="EXPENSE",transfer="TRANSFER",sale="SALE",purchase="PURCHASE",collection="COLLECTION",payment="PAYMENT",openingBalance="OPENING_BALANCE",adjustment="ADJUSTMENT",reversal="REVERSAL" }
enum SyncState: String, Codable, Sendable { case pending="PENDING",syncing="SYNCING",synced="SYNCED",failed="FAILED",conflict="CONFLICT" }

