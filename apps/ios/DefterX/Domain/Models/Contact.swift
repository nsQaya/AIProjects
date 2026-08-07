import Foundation
struct Contact: Identifiable, Codable, Hashable, Sendable { let id: UUID; let bookId: UUID; var contactType: ContactType; var name: String; var companyName: String?; var accountId: UUID; var version: Int }
enum ContactType: String, Codable, CaseIterable, Sendable { case customer="CUSTOMER",supplier="SUPPLIER",person="PERSON",employee="EMPLOYEE",other="OTHER" }

