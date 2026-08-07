import SwiftUI
struct ContactsView:View{@EnvironmentObject var session:SessionStore;@State private var items:[Contact]=[];@State private var creating=false
 var body:some View{List(items){item in VStack(alignment:.leading){Text(item.name);Text(item.contactType.rawValue.capitalized).font(.caption).foregroundStyle(.secondary)}}.navigationTitle("Müşteri / Tedarikçi").toolbar{Button("Cari ekle",systemImage:"plus"){creating=true}}.sheet(isPresented:$creating,onDismiss:{Task{await load()}}){if let book=session.selectedBook{ContactCreateView(book:book)}}.task(id:session.selectedBook?.id){await load()}.refreshable{await load()}}
 func load()async{guard let id=session.selectedBook?.id else{return};items=(try? await session.container.contacts.list(bookId:id)) ?? []}
}
struct ContactCreateView:View{@EnvironmentObject var session:SessionStore;@Environment(\.dismiss)var dismiss;let book:Book;@State private var name="";@State private var company="";@State private var type=ContactType.customer;@State private var error:String?
 var body:some View{NavigationStack{Form{TextField("Ad",text:$name);TextField("Şirket",text:$company);Picker("Tür",selection:$type){ForEach(ContactType.allCases,id:\.self){Text($0.rawValue.capitalized).tag($0)}};if let error{Text(error).foregroundStyle(.red)}}.navigationTitle("Yeni Cari").toolbar{ToolbarItem(placement:.cancellationAction){Button("Vazgeç"){dismiss()}};ToolbarItem(placement:.confirmationAction){Button("Kaydet"){Task{await save()}}.disabled(name.isEmpty)}}}}
 func save()async{do{let _:ResourceIdentifier=try await session.container.api.send("POST","contacts",body:CreateContactRequest(bookId:book.id,contactType:type,name:name,companyName:company.isEmpty ? nil:company,currencyCode:book.baseCurrency));dismiss()}catch{self.error=error.localizedDescription}}
}

