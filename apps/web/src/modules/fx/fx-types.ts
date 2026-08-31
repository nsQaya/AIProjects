import type { MoneyString, UUID } from "@defterx/contracts";

/** An account the FX dialog can move money between. */
export interface FxAccountOption {
  readonly id: UUID;
  readonly name: string;
  readonly currencyCode: string;
  readonly isArchived: boolean;
}

export interface FxConversionValues {
  readonly fromAccountId: UUID;
  readonly toAccountId: UUID;
  readonly fromAmount: MoneyString;
  readonly toAmount: MoneyString;
  readonly transactionDate: string;
  readonly notes: string | null;
}
