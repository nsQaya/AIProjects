import SwiftUI
struct AccountCreateView:View{@EnvironmentObject var session:SessionStore;@Environment(\.dismiss)var dismiss;let book:Book;@State private var name="";@State private var type=AccountType.cash;@State private var error:String?
 var body:some View{NavigationStack{Form{TextField("Hesap adı",text:$name);Picker("Hesap türü",selection:$type){ForEach(AccountType.allCases,id:\.self){Text($0.rawValue.replacingOccurrences(of:"_",with:" ").capitalized).tag($0)}};if let error{Text(error).foregroundStyle(.red)}}.navigationTitle("Yeni Hesap").toolbar{ToolbarItem(placement:.cancellationAction){Button("Vazgeç"){dismiss()}};ToolbarItem(placement:.confirmationAction){Button("Kaydet"){Task{await save()}}.disabled(name.isEmpty)}}}}
 func save()async{do{let normal:BalanceDirection=[AccountType.creditCard,.supplier,.payable].contains(type) ? .credit:.debit;let _:ResourceIdentifier=try await session.container.api.send("POST","accounts",body:CreateAccountRequest(bookId:book.id,name:name,accountType:type,normalBalance:normal,currencyCode:book.baseCurrency));dismiss()}catch{self.error=error.localizedDescription}}
}

