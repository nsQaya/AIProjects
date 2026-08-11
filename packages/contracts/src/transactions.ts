import type {
  CurrencyCode,
  ISODateTimeString,
  MoneyString,
  SyncState,
  UUID,
  Version,
} from "./common.js";

/** Includes server-authored ledger events such as REVERSAL. */
export type TransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "SALE"
  | "PURCHASE"
  | "COLLECTION"
  | "PAYMENT"
  | "OPENING_BALANCE"
  | "ADJUSTMENT"
  | "REVERSAL";

/** Types accepted by POST /transactions and by correction replacement payloads. */
export type ClientTransactionType = Exclude<TransactionType, "REVERSAL">;
export type TransactionStatus = "DRAFT" | "POSTED" | "REVERSED" | "CANCELLED";

/**
 * Frontend-safe transaction mutation. REVERSAL is deliberately unavailable here;
 * reversals must use the dedicated reverse endpoint.
 */
export interface TransactionMutation {
  bookId: UUID;
  type: ClientTransactionType;
  title: string;
  amount: MoneyString;
  currencyCode: CurrencyCode;
  accountId: UUID;
  targetAccountId?: UUID;
  categoryId?: UUID;
  costCenterId?: UUID | null;
  contactId?: UUID;
  transactionDate: ISODateTimeString;
  dueDate?: ISODateTimeString;
  description?: string;
  clientOperationId: UUID;
}

export type CreateTransactionRequest = TransactionMutation;

export interface ReverseTransactionRequest {
  clientOperationId: UUID;
  reason: string;
}

export interface CorrectTransactionRequest {
  reversalClientOperationId: UUID;
  reason: string;
  replacement: TransactionMutation;
}

export interface TransactionListItemDTO {
  id: UUID;
  transactionNo: string;
  type: Exclude<TransactionType, "REVERSAL">;
  accountId: UUID | null;
  accountName: string | null;
  targetAccountId: UUID | null;
  targetAccountName: string | null;
  title: string;
  description: string | null;
  transactionDate: ISODateTimeString;
  dueDate: ISODateTimeString | null;
  status: "POSTED";
  currencyCode: CurrencyCode;
  categoryId: UUID | null;
  categoryName: string | null;
  costCenterId: UUID | null;
  costCenterName: string | null;
  contactId: UUID | null;
  version: Version;
  amount: MoneyString;
  /** Server-authored delta for the selected account scope. Never recompute it in the client. */
  balanceDelta: MoneyString;
  /** Server-authored running balance for the selected account scope. */
  runningBalance: MoneyString;
}

/**
 * Semantic account selection for GET /transactions.
 * Omit accountIds for every account, use "none" for no accounts, or serialize the
 * selected UUID array as a comma-separated accountIds query value. The literal
 * "all" is not accepted by this endpoint.
 */
export type TransactionAccountSelection = "none" | readonly UUID[];

export interface ListTransactionsQuery {
  bookId: UUID;
  limit?: number;
  cursor?: ISODateTimeString;
  accountIds?: TransactionAccountSelection;
  /** @deprecated Prefer accountIds. This remains available for the legacy route contract. */
  accountId?: UUID;
  categoryId?: UUID;
  costCenterId?: UUID;
  from?: ISODateTimeString;
  to?: ISODateTimeString;
}

export interface TransactionListResponse {
  items: TransactionListItemDTO[];
  /** Balance before `from`; returned as "0" when no start date is supplied. */
  openingBalance: MoneyString;
  nextCursor: ISODateTimeString | null;
}

/** Common response surface across first-write and idempotent replay paths. */
export interface TransactionMutationResultDTO {
  id: UUID;
  type: TransactionType;
  title: string;
  status: TransactionStatus;
  currencyCode: CurrencyCode;
  version: Version;
  bookId?: UUID;
  transactionNo?: string;
  accountId?: UUID | null;
  targetAccountId?: UUID | null;
  categoryId?: UUID | null;
  costCenterId?: UUID | null;
  contactId?: UUID | null;
  description?: string | null;
  transactionDate?: ISODateTimeString;
  dueDate?: ISODateTimeString | null;
  clientOperationId?: UUID;
  createdAt?: ISODateTimeString;
  amount?: MoneyString;
}

export type CreateTransactionResponse = TransactionMutationResultDTO;
export type ReverseTransactionResponse = TransactionMutationResultDTO;

export interface CorrectTransactionResponse {
  reversal: TransactionMutationResultDTO;
  transaction: TransactionMutationResultDTO;
}

export interface SyncOperation {
  operationId: UUID;
  entity: "transaction";
  action: "create";
  baseVersion?: number;
  payload: TransactionMutation;
}

export interface SyncPushRequest {
  operations: SyncOperation[];
}

export interface SyncPushResult {
  operationId: UUID;
  status: SyncState;
  entity?: TransactionMutationResultDTO;
  error?: { code: string; message: string };
}

export interface SyncPushResponse {
  results: SyncPushResult[];
}
