import SwiftUI
enum DesignTokens{static let corner:CGFloat=16;static let spacing:CGFloat=16;static let positive=Color.green;static let negative=Color.red;static let surface=Color(.secondarySystemBackground)}
struct FinanceCard<Content:View>:View{let content:Content;init(@ViewBuilder content:()->Content){self.content=content()}var body:some View{content.padding().frame(maxWidth:.infinity,alignment:.leading).background(DesignTokens.surface,in:RoundedRectangle(cornerRadius:DesignTokens.corner))}}

