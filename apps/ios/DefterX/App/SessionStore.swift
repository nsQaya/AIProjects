import SwiftUI

@MainActor final class SessionStore:ObservableObject{
 @Published var isAuthenticated=false;@Published var selectedBook:Book?;@Published var books:[Book]=[];@Published var errorMessage:String?
 let container:AppContainer
 init(container:AppContainer){self.container=container}
 func restore()async{do{try await container.api.restoreSession();isAuthenticated=true;try await loadBooks()}catch{isAuthenticated=false}}
 func login(email:String,password:String)async{do{_ = try await container.api.login(email:email,password:password);isAuthenticated=true;try await loadBooks()}catch{errorMessage=error.localizedDescription}}
 func register(email:String,password:String,displayName:String)async{do{_ = try await container.api.register(email:email,password:password,displayName:displayName);isAuthenticated=true;try await loadBooks()}catch{errorMessage=error.localizedDescription}}
 func loadBooks()async throws{books=try await container.books.list();if selectedBook==nil{selectedBook=books.first}}
 func logout()async{await container.tokenVault.clear();isAuthenticated=false;selectedBook=nil}
}
