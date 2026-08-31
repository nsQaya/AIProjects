import type { Direction, TransactionType } from "@defterx/contracts";

export interface LedgerEntryDraft { accountId: string; direction: Direction; amount: string; currencyCode: string; baseAmount: string }
export interface LedgerMappingInput {
  type: TransactionType;
  amount: string;
  currencyCode: string;
  /** Book-base-currency (TRY) value of `amount`. Defaults to `amount` for single-currency transactions. */
  baseAmount?: string;
  accountId: string;
  targetAccountId?: string;
  categoryAccountId?: string;
  contactAccountId?: string;
  equityAccountId?: string;
}

