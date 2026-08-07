import Foundation
actor TokenVault{
 private let keychain:KeychainStore;private var accessToken:String?
 init(keychain:KeychainStore){self.keychain=keychain}
 func access()->String?{accessToken}
 func refresh()->String?{keychain.get("refresh_token")}
 func save(access:String,refresh:String)throws{accessToken=access;try keychain.set(refresh,for:"refresh_token")}
 func clear(){accessToken=nil;keychain.remove("refresh_token")}
}

