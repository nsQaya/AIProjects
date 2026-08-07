import Foundation
import Security

final class KeychainStore: @unchecked Sendable {
    private let service:String
    init(service:String=Bundle.main.bundleIdentifier ?? "finance.mobile"){self.service=service}
    func set(_ value:String,for key:String)throws{let data=Data(value.utf8);let query:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,kSecAttrAccount as String:key];SecItemDelete(query as CFDictionary);var insert=query;insert[kSecValueData as String]=data;insert[kSecAttrAccessible as String]=kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly;guard SecItemAdd(insert as CFDictionary,nil)==errSecSuccess else{throw KeychainError.writeFailed}}
    func get(_ key:String)->String?{let query:[String:Any]=[kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,kSecAttrAccount as String:key,kSecReturnData as String:true,kSecMatchLimit as String:kSecMatchLimitOne];var result:CFTypeRef?;guard SecItemCopyMatching(query as CFDictionary,&result)==errSecSuccess,let data=result as? Data else{return nil};return String(data:data,encoding:.utf8)}
    func remove(_ key:String){SecItemDelete([kSecClass as String:kSecClassGenericPassword,kSecAttrService as String:service,kSecAttrAccount as String:key] as CFDictionary)}
}
enum KeychainError:Error{case writeFailed}

