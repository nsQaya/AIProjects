import type {
  CurrencyCode,
  DeletedEntityResponse,
  ISODateTimeString,
  MoneyString,
  UUID,
  Version,
} from "./common.js";
import type { TransactionMutationResultDTO } from "./transactions.js";

export type ScheduledTransactionType =
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER"
  | "SALE"
  | "PURCHASE"
  | "COLLECTION"
  | "PAYMENT";

export type ScheduledStatus = "PENDING" | "COMPLETED" | "SKIPPED" | "CANCELLED" | "OVERDUE";
export type ScheduledRecurrenceFrequency = "WEEKLY" | "MONTHLY" | "YEARLY";

export interface ScheduledRecurrenceRequest {
  frequency: ScheduledRecurrenceFrequency;
  interval?: number;
  until: ISODateTimeString;
}

export interface ScheduledTransactionDTO {
  id: UUID;
  bookId: UUID;
  accountId: UUID;
  targetAccountId: UUID | null;
  transactionType: ScheduledTransactionType;
  categoryId: UUID | null;
  costCenterId: UUID | null;
  costCenterName: string | null;
  contactId: UUID | null;
  title: string;
  amount: MoneyString;
  currencyCode: CurrencyCode;
  scheduledAt: ISODateTimeString;
  reminderAt: ISODateTimeString | null;
  status: ScheduledStatus;
  seriesId: UUID | null;
  recurrenceFrequency: ScheduledRecurrenceFrequency | null;
  recurrenceInterval: number | null;
  recurrenceEndAt: ISODateTimeString | null;
  completedTransactionId: UUID | null;
  version: Version;
}

export interface CreateScheduledTransactionRequest {
  bookId: UUID;
  accountId: UUID;
  targetAccountId?: UUID | null;
  transactionType: ScheduledTransactionType;
  categoryId?: UUID | null;
  costCenterId?: UUID | null;
  contactId?: UUID | null;
  title: string;
  amount: MoneyString;
  currencyCode: CurrencyCode;
  scheduledAt: ISODateTimeString;
  reminderAt?: ISODateTimeString | null;
  recurrence?: ScheduledRecurrenceRequest;
}

export interface UpdateScheduledTransactionRequest {
  accountId?: UUID;
  targetAccountId?: UUID | null;
  transactionType?: ScheduledTransactionType;
  categoryId?: UUID | null;
  costCenterId?: UUID | null;
  contactId?: UUID | null;
  title?: string;
  amount?: MoneyString;
  scheduledAt?: ISODateTimeString;
  reminderAt?: ISODateTimeString | null;
  version: Version;
}

export interface SetScheduledStatusRequest {
  status: "SKIPPED" | "CANCELLED";
  version: Version;
}

export interface RealizeScheduledTransactionRequest {
  version: Version;
  transactionDate?: ISODateTimeString;
  clientOperationId: UUID;
}

export interface ScheduledTransactionGroups {
  overdue: ScheduledTransactionDTO[];
  today: ScheduledTransactionDTO[];
  thisWeek: ScheduledTransactionDTO[];
  thisMonth: ScheduledTransactionDTO[];
  later: ScheduledTransactionDTO[];
}

export interface ScheduledTransactionListResponse {
  items: ScheduledTransactionDTO[];
  groups: ScheduledTransactionGroups;
}

export interface ListScheduledTransactionsQuery {
  bookId: UUID;
  /** The endpoint only includes completed records when view is "all". */
  view?: "all";
}

export type CreateScheduledTransactionResponse = ScheduledTransactionDTO & { createdCount: number };
export type UpdateScheduledTransactionResponse = ScheduledTransactionDTO;

export interface SetScheduledStatusResponse {
  id: UUID;
  status: "SKIPPED" | "CANCELLED";
  version: Version;
}

export interface AlreadyRealizedScheduledTransactionResponse {
  id: UUID;
  status: "COMPLETED";
  version: Version;
  completedTransactionId: UUID;
}

export interface NewlyRealizedScheduledTransactionResponse {
  scheduled: ScheduledTransactionDTO & { status: "COMPLETED"; completedTransactionId: UUID };
  transaction: TransactionMutationResultDTO;
}

export type RealizeScheduledTransactionResponse =
  | AlreadyRealizedScheduledTransactionResponse
  | NewlyRealizedScheduledTransactionResponse;

export type DeleteScheduledTransactionResponse = DeletedEntityResponse;

export type RecurringFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "CUSTOM";

export interface RecurringTransactionDTO {
  id: UUID;
  bookId: UUID;
  accountId: UUID;
  targetAccountId: UUID | null;
  transactionType: ScheduledTransactionType;
  categoryId: UUID | null;
  contactId: UUID | null;
  title: string;
  amount: MoneyString;
  currencyCode: CurrencyCode;
  startDate: ISODateTimeString;
  endDate: ISODateTimeString | null;
  nextRunAt: ISODateTimeString;
  frequency: RecurringFrequency;
  interval: number;
  isActive: boolean;
  version: Version;
}

export type RecurringTransactionListResponse = { items: RecurringTransactionDTO[] };

export interface ListRecurringTransactionsQuery {
  bookId: UUID;
}

export interface CreateRecurringTransactionRequest {
  bookId: UUID;
  accountId: UUID;
  targetAccountId?: UUID;
  transactionType: ScheduledTransactionType;
  categoryId?: UUID;
  contactId?: UUID;
  title: string;
  amount: MoneyString;
  currencyCode: CurrencyCode;
  startDate: ISODateTimeString;
  endDate?: ISODateTimeString;
  nextRunAt: ISODateTimeString;
  frequency: RecurringFrequency;
  interval: number;
}

/** The legacy recurring create endpoint returns a smaller projection than list. */
export interface CreateRecurringTransactionResponse {
  id: UUID;
  bookId: UUID;
  title: string;
  amount: MoneyString;
  currencyCode: CurrencyCode;
  nextRunAt: ISODateTimeString;
  frequency: RecurringFrequency;
  interval: number;
  isActive: boolean;
  version: Version;
}
