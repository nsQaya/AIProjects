import Foundation

@MainActor final class AppContainer{
 let keychain:KeychainStore;let tokenVault:TokenVault;let api:APIClient;let database:AppDatabase;let referenceCache:ReferenceCache
 let transactions:LocalTransactionRepository;let books:RemoteBookRepository;let accounts:RemoteAccountRepository;let categories:RemoteCategoryRepository;let contacts:RemoteContactRepository;let sync:SyncEngine
 init()throws{keychain=KeychainStore();tokenVault=TokenVault(keychain:keychain);api=APIClient(baseURL:Configuration.apiBaseURL,tokens:tokenVault);database=try AppDatabase();referenceCache=ReferenceCache(database:database);transactions=LocalTransactionRepository(database:database);books=RemoteBookRepository(api:api,cache:referenceCache);accounts=RemoteAccountRepository(api:api,cache:referenceCache);categories=RemoteCategoryRepository(api:api,cache:referenceCache);contacts=RemoteContactRepository(api:api,cache:referenceCache);sync=SyncEngine(local:transactions,api:api)}
}

