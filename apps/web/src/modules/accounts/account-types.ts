import type {
  AccountPostingContextDTO,
  AccountShareDTO,
  AccountSharePermission,
  MoneyString,
  UUID,
  Version,
} from "@defterx/contracts";
import type { SharedAccountView, TransactionView } from "../../finance/finance-views";

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

export interface SharedAccountTransactionDraft {
  type: "INCOME" | "EXPENSE";
  title: string;
  /** Decimal string in the account's own currency. */
  amount: MoneyString;
  categoryId: UUID;
  costCenterId?: UUID;
  /** ISO datetime. */
  transactionDate: string;
}

/**
 * Everything the Accounts page needs to show and drive account sharing. Optional
 * on the page so a bare `<AccountsPage>` (tests, storybook) still renders.
 */
export interface AccountSharingApi {
  /** Accounts other users have shared with the signed-in user. */
  sharedAccounts: readonly SharedAccountView[];
  /** Owner side: who an account is currently shared with. Not routed through the snapshot refresh. */
  listShares: (accountId: UUID) => Promise<readonly AccountShareDTO[]>;
  shareAccount: (
    accountId: UUID,
    values: { email: string; permission: AccountSharePermission },
  ) => AccountMutation;
  updateShare: (
    accountId: UUID,
    shareId: UUID,
    values: { permission: AccountSharePermission; version: Version },
  ) => AccountMutation;
  revokeShare: (accountId: UUID, shareId: UUID) => AccountMutation;
  /** Grantee side: read the shared account's ledger from the owner's book. */
  loadSharedTransactions: (
    accountId: UUID,
    ownerBookId: UUID,
  ) => Promise<readonly TransactionView[]>;
  /** Grantee side: owner-book categories / cost centers needed to post. */
  loadPostingContext: (accountId: UUID) => Promise<AccountPostingContextDTO>;
  /** Grantee side: post an income/expense into the owner's book. */
  createSharedTransaction: (
    ownerBookId: UUID,
    accountId: UUID,
    currencyCode: string,
    draft: SharedAccountTransactionDraft,
  ) => AccountMutation;
}
