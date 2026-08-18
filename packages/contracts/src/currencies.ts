import type {
  CurrencyCode,
  ISODateTimeString,
  ItemListResponse,
  MoneyString,
  UUID,
} from "./common.js";

export interface CurrencyDTO {
  code: CurrencyCode;
  nameTr: string;
  nameEn: string;
  isEnabled: boolean;
}

export type CurrencyListResponse = ItemListResponse<CurrencyDTO>;

export interface EnableCurrencyRequest {
  bookId: UUID;
}

export interface EnableCurrencyResponse {
  code: CurrencyCode;
  isEnabled: true;
}

export interface DisableCurrencyResponse {
  code: CurrencyCode;
  isEnabled: false;
}

export interface CurrencyRateAtDateDTO {
  currencyCode: CurrencyCode;
  rateDate: string;
  tryRate: MoneyString;
  available: boolean;
  source: "TCMB" | "MISSING";
}

export type CurrencyRatesAtDateResponse = ItemListResponse<CurrencyRateAtDateDTO>;

export interface SyncCurrencyRatesRequest {
  bookId: UUID;
  date: string;
}

export interface CurrencyRateSyncRunDTO {
  id: UUID;
  kind: "CURRENCY_RATES";
  targetDate: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  totalItems: number;
  processedItems: number;
  updatedItems: number;
  missingItems: number;
  failedItems: number;
  startedAt: ISODateTimeString | null;
  completedAt: ISODateTimeString | null;
  createdAt: ISODateTimeString;
}
