import type { AccountType, MoneyString, UUID, Version } from "@defterx/contracts";

/**
 * The account page only needs this projection of the server DTO. Keeping the
 * projection narrow lets the route pass AccountDTO values without coupling the
 * UI to book, currency or ledger implementation details.
 */
export interface AccountViewModel {
  readonly id: UUID;
  readonly name: string;
  readonly accountType: AccountType;
  readonly displayBalance: MoneyString;
  readonly allowNegativeBalance: boolean;
  readonly creditLimit: MoneyString | null;
  readonly availableCredit: MoneyString | null;
  readonly isArchived: boolean;
  readonly version: Version;
}

export interface AccountFormValues {
  readonly name: string;
  readonly accountType: AccountType;
  readonly allowNegativeBalance: boolean;
  readonly creditLimit: MoneyString | null;
}

export interface CreateAccountValues extends AccountFormValues {
  readonly openingBalance: MoneyString;
}

export interface UpdateAccountValues extends AccountFormValues {
  readonly version: Version;
}

/** A resolved value means success; resolving `false` deliberately keeps the editor open. */
export type AccountMutation = Promise<unknown>;

export interface AccountsPageCallbacks {
  onCreateAccount: (values: CreateAccountValues) => AccountMutation;
  onDeleteAccount: (id: UUID, version: Version) => AccountMutation;
  onUpdateAccount: (id: UUID, values: UpdateAccountValues) => AccountMutation;
}
