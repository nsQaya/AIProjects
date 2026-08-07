import BackgroundTasks
import Foundation

final class BackgroundSyncScheduler{
 private let engine:SyncEngine;private let selectedBook:@Sendable()->UUID?
 init(engine:SyncEngine,selectedBook:@escaping @Sendable()->UUID?){self.engine=engine;self.selectedBook=selectedBook}
 func register(){BGTaskScheduler.shared.register(forTaskWithIdentifier:Configuration.backgroundTaskIdentifier,using:nil){[weak self]task in guard let self,let refresh=task as? BGAppRefreshTask else{return};self.schedule();let work=Task{if let bookId=self.selectedBook(){await self.engine.sync(bookId:bookId)}};refresh.expirationHandler={work.cancel()};Task{_ = await work.result;refresh.setTaskCompleted(success:!work.isCancelled)}}}
 func schedule(){let request=BGAppRefreshTaskRequest(identifier:Configuration.backgroundTaskIdentifier);request.earliestBeginDate=Date(timeIntervalSinceNow:15*60);try? BGTaskScheduler.shared.submit(request)}
}

