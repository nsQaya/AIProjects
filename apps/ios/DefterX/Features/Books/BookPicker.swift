import SwiftUI
struct BookPicker:View{@EnvironmentObject var session:SessionStore;@State private var creating=false;var body:some View{Menu{ForEach(session.books){book in Button(book.name){session.selectedBook=book}};Divider();Button("Yeni Defter",systemImage:"plus"){creating=true}}label:{Label(session.selectedBook?.name ?? "Defter Seç",systemImage:"chevron.down.circle")}.sheet(isPresented:$creating){BookCreateView()}}}

