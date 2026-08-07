export class TransactionRepository {
  getSnapshot() { throw new Error("getSnapshot must be implemented"); }
  addTransaction(_transaction) { throw new Error("addTransaction must be implemented"); }
  updateTransaction(_transaction) { throw new Error("updateTransaction must be implemented"); }
  removeTransaction(_transactionId) { throw new Error("removeTransaction must be implemented"); }
  addAccount(_account) { throw new Error("addAccount must be implemented"); }
  addScheduledTransaction(_transaction) { throw new Error("addScheduledTransaction must be implemented"); }
  reset() { throw new Error("reset must be implemented"); }
}
