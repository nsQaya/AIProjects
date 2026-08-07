import Foundation
import GRDB

struct LocalTransactionRecord: Codable, FetchableRecord, PersistableRecord {
    static let databaseTableName="local_transactions"
    var id:String;var bookId:String;var type:String;var title:String;var amount:String;var currencyCode:String;var accountId:String;var targetAccountId:String?;var categoryId:String?;var contactId:String?;var transactionDate:Date;var dueDate:Date?;var details:String?;var clientOperationId:String;var serverVersion:Int?;var syncState:String
}
struct OperationRecord: Codable, FetchableRecord, PersistableRecord { static let databaseTableName="sync_operations";var id:String;var entity:String;var action:String;var payload:Data;var state:String;var attempts:Int;var lastError:String?;var createdAt:Date }

