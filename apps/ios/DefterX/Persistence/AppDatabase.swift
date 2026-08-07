import Foundation
import GRDB

final class AppDatabase: @unchecked Sendable {
    let writer: any DatabaseWriter
    init(inMemory: Bool = false) throws {
        if inMemory { writer = try DatabaseQueue() }
        else { let folder=try FileManager.default.url(for:.applicationSupportDirectory,in:.userDomainMask,appropriateFor:nil,create:true);writer=try DatabasePool(path:folder.appendingPathComponent("finance.sqlite").path) }
        var migrator=DatabaseMigrator()
        migrator.registerMigration("v1") { db in
            try db.create(table:"local_transactions") { t in
                t.column("id",.text).primaryKey();t.column("bookId",.text).notNull().indexed();t.column("type",.text).notNull();t.column("title",.text).notNull();t.column("amount",.text).notNull();t.column("currencyCode",.text).notNull();t.column("accountId",.text).notNull();t.column("targetAccountId",.text);t.column("categoryId",.text);t.column("contactId",.text);t.column("transactionDate",.datetime).notNull().indexed();t.column("dueDate",.datetime);t.column("details",.text);t.column("clientOperationId",.text).notNull().unique();t.column("serverVersion",.integer);t.column("syncState",.text).notNull().indexed()
            }
            try db.create(table:"sync_operations") { t in
                t.column("id",.text).primaryKey();t.column("entity",.text).notNull();t.column("action",.text).notNull();t.column("payload",.blob).notNull();t.column("state",.text).notNull().indexed();t.column("attempts",.integer).notNull().defaults(to:0);t.column("lastError",.text);t.column("createdAt",.datetime).notNull()
            }
            try db.create(table:"sync_cursors") { t in t.column("bookId",.text).primaryKey();t.column("cursor",.text).notNull() }
        }
        migrator.registerMigration("v2-reference-cache") { db in
            try db.create(table:"reference_cache") { t in
                t.column("kind",.text).notNull();t.column("id",.text).notNull();t.column("bookId",.text).notNull().defaults(to:"");t.column("payload",.blob).notNull();t.column("updatedAt",.datetime).notNull();t.primaryKey(["kind","id"])
            }
            try db.create(index:"reference_cache_lookup",on:"reference_cache",columns:["kind","bookId"])
        }
        try migrator.migrate(writer)
    }
}
