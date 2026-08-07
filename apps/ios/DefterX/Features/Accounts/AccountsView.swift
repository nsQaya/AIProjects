import SwiftUI
struct AccountsView:View{@EnvironmentObject var session:SessionStore;@State private var items:[Account]=[];@State private var error:String?;@State private var creating=false
 var body:some View{NavigationStack{List(items){account in HStack{Image(systemName:icon(account.accountType));VStack(alignment:.leading){Text(account.name);Text(account.currencyCode).font(.caption).foregroundStyle(.secondary)};Spacer();Image(systemName:"chevron.right").foregroundStyle(.tertiary)}}.overlay{if items.isEmpty{ContentUnavailableView("Hesap yok",systemImage:"creditcard")}}.navigationTitle("Hesaplar").toolbar{Button("Hesap ekle",systemImage:"plus"){creating=true}}.sheet(isPresented:$creating,onDismiss:{Task{await load()}}){if let book=session.selectedBook{AccountCreateView(book:book)}}.task(id:session.selectedBook?.id){await load()}.refreshable{await load()}}}
 func load()async{guard let id=session.selectedBook?.id else{return};do{items=try await session.container.accounts.list(bookId:id)}catch{self.error=error.localizedDescription}}
 func icon(_ type:AccountType)->String{switch type{case.cash:"banknote";case.bank:"building.columns";case.creditCard:"creditcard";default:"wallet.bifold"}}
}

