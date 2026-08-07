import SwiftUI
struct CategoriesView:View{@EnvironmentObject var session:SessionStore;@State private var items:[Category]=[];@State private var creating=false
 var body:some View{List(items){item in Label(item.name,systemImage:item.icon ?? (item.categoryType == .income ? "arrow.down.circle":"arrow.up.circle"))}.navigationTitle("Kategoriler").toolbar{Button("Kategori ekle",systemImage:"plus"){creating=true}}.sheet(isPresented:$creating,onDismiss:{Task{await load()}}){if let book=session.selectedBook{CategoryCreateView(book:book)}}.task(id:session.selectedBook?.id){await load()}.refreshable{await load()}}
 func load()async{guard let id=session.selectedBook?.id else{return};items=(try? await session.container.categories.list(bookId:id)) ?? []}
}
struct CategoryCreateView:View{@EnvironmentObject var session:SessionStore;@Environment(\.dismiss)var dismiss;let book:Book;@State private var name="";@State private var type=CategoryType.expense;@State private var error:String?
 var body:some View{NavigationStack{Form{TextField("Kategori adı",text:$name);Picker("Tür",selection:$type){Text("Gelir").tag(CategoryType.income);Text("Gider").tag(CategoryType.expense)};if let error{Text(error).foregroundStyle(.red)}}.navigationTitle("Yeni Kategori").toolbar{ToolbarItem(placement:.cancellationAction){Button("Vazgeç"){dismiss()}};ToolbarItem(placement:.confirmationAction){Button("Kaydet"){Task{await save()}}.disabled(name.isEmpty)}}}}
 func save()async{do{let _:ResourceIdentifier=try await session.container.api.send("POST","categories",body:CreateCategoryRequest(bookId:book.id,name:name,categoryType:type,currencyCode:book.baseCurrency,icon:nil));dismiss()}catch{self.error=error.localizedDescription}}
}
