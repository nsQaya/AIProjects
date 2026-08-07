import SwiftUI

@main struct DefterXApp:App{
 @StateObject private var session:SessionStore;@StateObject private var lock=BiometricLock()
 init(){let container=try! AppContainer();_session=StateObject(wrappedValue:SessionStore(container:container))}
 var body:some Scene{WindowGroup{Group{if !lock.isUnlocked{ProgressView("Kilit açılıyor…").task{await lock.unlock()}}else if session.isAuthenticated{RootTabView()}else{LoginView()}}.environmentObject(session).onReceive(NotificationCenter.default.publisher(for:UIApplication.didEnterBackgroundNotification)){_ in lock.lock()}.task{await session.restore()}}}
}

