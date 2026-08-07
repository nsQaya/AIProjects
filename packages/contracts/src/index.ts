export type MoneyString = string;
export type BookRole = "OWNER" | "ADMIN" | "EDITOR" | "ACCOUNTANT" | "VIEWER";
export type BookType = "PERSONAL" | "BUSINESS" | "OTHER";
export type Direction = "DEBIT" | "CREDIT";
export type TransactionType =
  | "INCOME" | "EXPENSE" | "TRANSFER" | "SALE" | "PURCHASE"
  | "COLLECTION" | "PAYMENT" | "OPENING_BALANCE" | "ADJUSTMENT" | "REVERSAL";
export type SyncState = "PENDING" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";

export interface TransactionMutation {
  bookId: string;
  type: TransactionType;
  title: string;
  amount: MoneyString;
  currencyCode: string;
  accountId: string;
  targetAccountId?: string;
  categoryId?: string;
  contactId?: string;
  transactionDate: string;
  dueDate?: string;
  description?: string;
  clientOperationId: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown; requestId?: string };
}

export interface SyncOperation {
  operationId: string;
  entity: "transaction";
  action: "create";
  baseVersion?: number;
  payload: TransactionMutation;
}

