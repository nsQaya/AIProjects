import Foundation
import LocalAuthentication

@MainActor final class BiometricLock:ObservableObject{
 @Published private(set)var isUnlocked=false
 func unlock()async{let context=LAContext();var error:NSError?;guard context.canEvaluatePolicy(.deviceOwnerAuthentication,error:&error)else{isUnlocked=true;return};do{isUnlocked=try await context.evaluatePolicy(.deviceOwnerAuthentication,localizedReason:"Finansal verilerinize erişin")}catch{isUnlocked=false}}
 func lock(){isUnlocked=false}
}

