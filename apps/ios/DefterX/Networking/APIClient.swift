import Foundation

actor APIClient{
 private let baseURL:URL;private let session:URLSession;private let tokens:TokenVault
 private var refreshTask:Task<Void,Error>?
 private let encoder:JSONEncoder={let x=JSONEncoder();x.dateEncodingStrategy = .iso8601;return x}()
 private let decoder:JSONDecoder={let x=JSONDecoder();x.dateDecodingStrategy = .iso8601;return x}()
 init(baseURL:URL,tokens:TokenVault,session:URLSession = .shared){self.baseURL=baseURL;self.tokens=tokens;self.session=session}
 func get<Response:Decodable>(_ path:String,query:[URLQueryItem]=[],authenticated:Bool=true)async throws->Response{try await perform("GET",path,query:query,body:nil,idempotencyKey:nil,authenticated:authenticated)}
 func send<Response:Decodable,Body:Encodable>(_ method:String,_ path:String,query:[URLQueryItem]=[],body:Body,idempotencyKey:String?=nil,authenticated:Bool=true)async throws->Response{try await perform(method,path,query:query,body:try encoder.encode(body),idempotencyKey:idempotencyKey,authenticated:authenticated)}
 private func perform<Response:Decodable>(_ method:String,_ path:String,query:[URLQueryItem],body:Data?,idempotencyKey:String?,authenticated:Bool,allowRefresh:Bool=true)async throws->Response{
  var components=URLComponents(url:baseURL.appending(path:path),resolvingAgainstBaseURL:false)!;if !query.isEmpty{components.queryItems=query};var request=URLRequest(url:components.url!);request.httpMethod=method;request.setValue("application/json",forHTTPHeaderField:"Accept");if let body{request.httpBody=body;request.setValue("application/json",forHTTPHeaderField:"Content-Type")};if authenticated,let token=await tokens.access(){request.setValue("Bearer \(token)",forHTTPHeaderField:"Authorization")};if let idempotencyKey{request.setValue(idempotencyKey,forHTTPHeaderField:"Idempotency-Key")}
  let(data,response)=try await session.data(for:request);guard let http=response as? HTTPURLResponse else{throw URLError(.badServerResponse)};if http.statusCode==401&&authenticated&&allowRefresh{try await refreshTokens();return try await perform(method,path,query:query,body:body,idempotencyKey:idempotencyKey,authenticated:true,allowRefresh:false)};guard(200..<300).contains(http.statusCode)else{if let value=try? decoder.decode(APIErrorEnvelope.self,from:data){throw value.error};throw URLError(.badServerResponse)};return try decoder.decode(Response.self,from:data)
 }
 func login(email:String,password:String)async throws->UserProfile{let response:TokenResponse=try await send("POST","auth/login",body:LoginRequest(email:email,password:password),authenticated:false);try await tokens.save(access:response.accessToken,refresh:response.refreshToken);return response.user!}
 func register(email:String,password:String,displayName:String)async throws->UserProfile{let response:TokenResponse=try await send("POST","auth/register",body:RegisterRequest(email:email,password:password,displayName:displayName),authenticated:false);try await tokens.save(access:response.accessToken,refresh:response.refreshToken);return response.user!}
 func restoreSession()async throws{try await refreshTokens()}
 private func refreshTokens()async throws{if let refreshTask{return try await refreshTask.value};let task=Task{try await self.performRefresh()};refreshTask=task;do{try await task.value;refreshTask=nil}catch{refreshTask=nil;await tokens.clear();throw error}}
 private func performRefresh()async throws{guard let refresh=await tokens.refresh()else{throw URLError(.userAuthenticationRequired)};let response:TokenResponse=try await send("POST","auth/refresh",body:RefreshRequest(refreshToken:refresh),authenticated:false);try await tokens.save(access:response.accessToken,refresh:response.refreshToken)}
}
