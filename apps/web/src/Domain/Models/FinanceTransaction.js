export const TransactionKinds = Object.freeze({ income: "Gelir", expense: "Gider", transfer: "Transfer" });

export function createTransaction(input) {
  return {
    id: crypto.randomUUID(),
    kind: input.kind,
    amount: Number(input.amount),
    description: input.description.trim(),
    date: input.date,
    accountId: input.accountId,
    targetAccountId: input.targetAccountId || null,
    categoryId: input.categoryId || null,
    syncState: "local"
  };
}
