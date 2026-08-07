import Foundation

struct Page<T:Codable & Sendable>:Codable,Sendable{let items:[T]}
struct TokenResponse:Codable,Sendable{let accessToken:String;let refreshToken:String;let expiresIn:Int;let user:UserProfile?}
struct UserProfile:Codable,Sendable{let id:UUID;let email:String;let displayName:String}
struct LoginRequest:Codable{let email:String;let password:String}
struct RegisterRequest:Codable{let email:String;let password:String;let displayName:String}
struct RefreshRequest:Codable{let refreshToken:String}
struct TransactionMutationDTO:Codable,Sendable{
 let bookId:UUID;let type:TransactionType;let title:String;let amount:String;let currencyCode:String;let accountId:UUID;let targetAccountId:UUID?;let categoryId:UUID?;let contactId:UUID?;let transactionDate:Date;let dueDate:Date?;let description:String?;let clientOperationId:UUID
 init(_ item:FinanceTransaction){bookId=item.bookId;type=item.type;title=item.title;amount=item.amount.decimalString;currencyCode=item.currencyCode;accountId=item.accountId;targetAccountId=item.targetAccountId;categoryId=item.categoryId;contactId=item.contactId;transactionDate=item.transactionDate;dueDate=item.dueDate;description=item.details;clientOperationId=item.clientOperationId}
}
struct ServerTransaction:Codable,Sendable{let id:UUID;let bookId:UUID;let type:TransactionType;let title:String;let amount:String;let currencyCode:String;let accountId:UUID?;let targetAccountId:UUID?;let categoryId:UUID?;let contactId:UUID?;let transactionDate:Date;let clientOperationId:UUID;let version:Int}
struct PushEnvelope:Encodable{let operations:[PushOperation]}
struct PushOperation:Encodable{let operationId:UUID;let entity:String;let action:String;let payload:TransactionMutationDTO}
struct PushResponse:Decodable{let results:[PushResult]}
struct PushResult:Decodable{let operationId:UUID;let status:SyncState;let entity:ServerTransaction?;let error:APIErrorPayload?}
struct PullResponse:Decodable{let changes:[SyncChange];let nextCursor:String;let hasMore:Bool}
struct APIErrorEnvelope:Decodable{let error:APIErrorPayload}
struct APIErrorPayload:Codable,Error,Sendable{let code:String;let message:String}
struct ResourceIdentifier:Decodable{let id:UUID}
struct CreateBookRequest:Encodable{let name:String;let bookType:BookType;let baseCurrency:String}
struct CreateAccountRequest:Encodable{let bookId:UUID;let name:String;let accountType:AccountType;let normalBalance:BalanceDirection;let currencyCode:String;let isArchived:Bool=false;let sortOrder:Int=0}
struct CreateCategoryRequest:Encodable{let bookId:UUID;let name:String;let categoryType:CategoryType;let currencyCode:String;let icon:String?;let sortOrder:Int=0}
struct CreateContactRequest:Encodable{let bookId:UUID;let contactType:ContactType;let name:String;let companyName:String?;let currencyCode:String}
