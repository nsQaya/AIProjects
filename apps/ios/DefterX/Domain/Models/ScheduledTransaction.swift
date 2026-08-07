import Foundation
struct ScheduledTransaction: Identifiable, Codable, Hashable, Sendable { let id: UUID; let bookId: UUID; var title: String; var amount: Money; var currencyCode: String; var scheduledAt: Date; var status: ScheduledStatus; var version: Int }
enum ScheduledStatus: String, Codable, Sendable { case pending="PENDING",completed="COMPLETED",skipped="SKIPPED",cancelled="CANCELLED",overdue="OVERDUE" }

