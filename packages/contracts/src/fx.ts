import type { CurrencyCode, ISODateTimeString, MoneyString, UUID } from "./common.js";

/**
 * Convert cash from one account's currency to another's at the rate implied by
 * the two amounts (one side must be the book base currency). Records a single
 * cross-currency ledger transaction.
 */
export interface CreateFxConversionRequest {
  bookId: UUID;
  /** Account the money leaves, in its own currency. */
  fromAccountId: UUID;
  /** Account the money arrives in, in its own currency. */
  toAccountId: UUID;
  fromAmount: MoneyString;
  toAmount: MoneyString;
  transactionDate: ISODateTimeString;
  notes?: string | null;
  clientOperationId: UUID;
}

export interface FxConversionDTO {
  id: UUID;
  transactionNo: string;
  title: string;
  description: string | null;
  transactionDate: ISODateTimeString;
  currencyCode: CurrencyCode;
  fromAccountId: UUID;
  fromAccountName: string;
  fromAmount: MoneyString;
  fromCurrency: CurrencyCode;
  toAccountId: UUID;
  toAccountName: string;
  toAmount: MoneyString;
  toCurrency: CurrencyCode;
  /** The book-base-currency (TRY) amount that moved. */
  tryAmount: MoneyString;
}

export type CreateFxConversionResponse = FxConversionDTO;
