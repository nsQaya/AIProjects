import type { MoneyString, UUID, Version } from "@defterx/contracts";

/**
 * The account page only needs this projection of the server DTO. Keeping the
 * projection narrow lets the route pass AccountDTO values without coupling the
 * UI to book, currency or ledger implementation details.
 */
export interface AccountViewModel {
  readonly id: UUID;
  readonly name: string;
  readonly accountTypeId: UUID;
  readonly accountTypeName: string;
  readonly accountTypeIcon: string | null;
  readonly currencyCode: string;
  readonly displayBalance: MoneyString;
  /** displayBalance converted to TRY at the latest rate; equals displayBalance for a TRY account. */
  readonly displayBalanceTry: MoneyString;
  /** Current opening-balance magnitude in the account's own currency; "0" when none. */
  readonly openingBalance: MoneyString;
  readonly allowNegativeBalance: boolean;
  readonly creditLimit: MoneyString | null;
  readonly availableCredit: MoneyString | null;
  readonly isArchived: boolean;
  readonly version: Version;
}

export interface AccountFormValues {
  readonly name: string;
  readonly accountTypeId: UUID;
  readonly allowNegativeBalance: boolean;
  readonly creditLimit: MoneyString | null;
}

export interface CreateAccountValues extends AccountFormValues {
  readonly openingBalance: MoneyString;
  /** Defaults to the book's base currency when omitted. Locked after creation. */
  readonly currencyCode?: string;
}

export interface UpdateAccountValues extends AccountFormValues {
  /** When set and different from the stored one, the opening balance is re-posted. */
  readonly openingBalance?: MoneyString;
  readonly version: Version;
}

/** A resolved value means success; resolving `false` deliberately keeps the editor open. */
export type AccountMutation = Promise<unknown>;

export interface AccountsPageCallbacks {
  onCreateAccount: (values: CreateAccountValues) => AccountMutation;
  onDeleteAccount: (id: UUID, version: Version) => AccountMutation;
  onUpdateAccount: (id: UUID, values: UpdateAccountValues) => AccountMutation;
}
