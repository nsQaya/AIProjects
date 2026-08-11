/** Decimal values are transported as strings so JavaScript never rounds ledger data. */
export type MoneyString = string;

/** UUIDs and ISO timestamps remain strings at the JSON boundary. */
export type UUID = string;
export type ISODateTimeString = string;
export type CurrencyCode = string;
export type Version = number;

export type Direction = "DEBIT" | "CREDIT";
export type SyncState = "PENDING" | "SYNCING" | "SYNCED" | "FAILED" | "CONFLICT";

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface ApiError {
  error: ApiErrorBody;
}

export interface ItemListResponse<T> {
  items: T[];
}

export interface VersionQuery {
  version: Version;
}

export interface DeletedEntityResponse {
  id: UUID;
  deleted: true;
  version: Version;
}
