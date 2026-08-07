import Foundation
struct Account: Identifiable, Codable, Hashable, Sendable { let id: UUID; let bookId: UUID; var name: String; var accountType: AccountType; var normalBalance: BalanceDirection; var currencyCode: String; var isArchived: Bool; var version: Int }
enum AccountType: String, Codable, CaseIterable, Sendable { case cash="CASH",bank="BANK",creditCard="CREDIT_CARD",customer="CUSTOMER",supplier="SUPPLIER",receivable="RECEIVABLE",payable="PAYABLE",savings="SAVINGS",budget="BUDGET",personnel="PERSONNEL",other="OTHER" }
enum BalanceDirection: String, Codable, Sendable { case debit="DEBIT",credit="CREDIT" }

