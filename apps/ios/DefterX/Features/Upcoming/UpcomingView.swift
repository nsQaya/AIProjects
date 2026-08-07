import SwiftUI
struct UpcomingGroups:Decodable{let overdue:[ScheduledTransaction];let today:[ScheduledTransaction];let thisWeek:[ScheduledTransaction];let thisMonth:[ScheduledTransaction];let later:[ScheduledTransaction]}
struct UpcomingView:View{@EnvironmentObject var session:SessionStore;@State private var groups:UpcomingGroups?
 var body:some View{NavigationStack{List{group("Gecikmiş",groups?.overdue ?? [],.red);group("Bugün",groups?.today ?? [],.orange);group("Bu Hafta",groups?.thisWeek ?? [],.primary);group("Bu Ay",groups?.thisMonth ?? [],.primary);group("Daha Sonra",groups?.later ?? [],.secondary)}.navigationTitle("Yaklaşan").task(id:session.selectedBook?.id){await load()}.refreshable{await load()}}}
 @ViewBuilder func group(_ title:String,_ items:[ScheduledTransaction],_ color:Color)->some View{if !items.isEmpty{Section(title){ForEach(items){item in HStack{VStack(alignment:.leading){Text(item.title);Text(item.scheduledAt,style:.date).font(.caption)};Spacer();Text(item.amount.formatted(currency:item.currencyCode)).foregroundStyle(color)}}}}}
 func load()async{guard let id=session.selectedBook?.id else{return};groups=try? await session.container.api.get("scheduled-transactions",query:[.init(name:"bookId",value:id.uuidString)])}
}

