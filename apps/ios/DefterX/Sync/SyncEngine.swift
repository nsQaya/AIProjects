import Foundation

actor SyncEngine{
 private let local:any TransactionRepository;private let api:APIClient
 init(local:any TransactionRepository,api:APIClient){self.local=local;self.api=api}
 func sync(bookId:UUID)async{
  do{for operation in try await local.pendingOperations(limit:50){try await local.setOperation(operation.operationId,state:.syncing,message:nil);do{let body=PushEnvelope(operations:[PushOperation(operationId:operation.operationId,entity:operation.entity,action:operation.action,payload:TransactionMutationDTO(operation.payload))]);let response:PushResponse=try await api.send("POST","sync/push",body:body,idempotencyKey:operation.operationId.uuidString);let result=response.results[0];try await local.setOperation(operation.operationId,state:result.status,message:result.error?.message)}catch let error as APIErrorPayload{try await local.setOperation(operation.operationId,state:error.code=="VERSION_CONFLICT" ? .conflict:.failed,message:error.message)}catch{try await local.setOperation(operation.operationId,state:.failed,message:error.localizedDescription)}}
   var next=try await local.syncCursor(bookId:bookId);var more=true;while more{let page:PullResponse=try await api.get("sync/pull",query:[.init(name:"bookId",value:bookId.uuidString),.init(name:"cursor",value:next)]);try await local.applyServerChanges(page.changes,cursor:page.nextCursor,bookId:bookId);next=page.nextCursor;more=page.hasMore}
  }catch{/* Reachability/background scheduler retries; local writes remain durable. */}
 }
}
