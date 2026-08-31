import type {
  CurrencyCode,
  DeletedEntityResponse,
  Direction,
  ItemListResponse,
  MoneyString,
  UUID,
  Version,
} from "./common.js";

export type AccountTypePurpose =
  | "SYSTEM_INCOME"
  | "SYSTEM_EXPENSE"
  | "SYSTEM_EQUITY"
  | "CUSTOMER"
  | "SUPPLIER"
  | "OTHER";

export interface AccountTypeDTO {
  id: UUID;
  bookId: UUID;
  name: string;
  icon: string | null;
  normalBalance: Direction;
  defaultAllowNegativeBalance: boolean;
  /** Stable system role this type carries (e.g. the book's SYSTEM_EQUITY account), null for ordinary/custom types. Never user-settable. */
  purpose: AccountTypePurpose | null;
  /** Accounts of this type hold money parked at a brokerage/custodian (Piapiri, Binance, a pension provider) and are the only accounts offered as buy/sell targets in the investments module. User-settable. */
  isInvestment: boolean;
  /** Seeded default type; cannot be hard-deleted, only deactivated. */
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  version: Version;
}

export type AccountTypeListResponse = ItemListResponse<AccountTypeDTO>;

export interface ListAccountTypesQuery {
  bookId: UUID;
  includeInactive?: boolean;
}

export interface CreateAccountTypeRequest {
  bookId: UUID;
  name: string;
  icon?: string | null;
  normalBalance: Direction;
  defaultAllowNegativeBalance?: boolean;
  isInvestment?: boolean;
  sortOrder?: number;
}

export interface UpdateAccountTypeRequest {
  name?: string;
  icon?: string | null;
  normalBalance?: Direction;
  defaultAllowNegativeBalance?: boolean;
  isInvestment?: boolean;
  sortOrder?: number;
  isActive?: boolean;
  version: Version;
}

export type CreateAccountTypeResponse = AccountTypeDTO;
export type UpdateAccountTypeResponse = AccountTypeDTO;

export interface DeactivatedAccountTypeResponse {
  id: UUID;
  isActive: false;
  version: Version;
}

export type DeleteAccountTypeResponse = DeletedEntityResponse | DeactivatedAccountTypeResponse;

export interface AccountDTO {
  id: UUID;
  bookId: UUID;
  contactId: UUID | null;
  name: string;
  accountTypeId: UUID;
  accountTypeName: string;
  accountTypeIcon: string | null;
  /** Denormalized from the account's type: true when this account holds money at a brokerage/custodian. */
  isInvestment: boolean;
  normalBalance: Direction;
  currencyCode: CurrencyCode;
  allowNegativeBalance: boolean;
  creditLimit: MoneyString | null;
  isArchived: boolean;
  sortOrder: number;
  version: Version;
  /** Ledger-sign balance, before display normalization for credit-normal accounts. */
  balance: MoneyString;
  /** User-facing balance in the account's own currency; credit-normal balances are sign-inverted by the server. */
  displayBalance: MoneyString;
  /** displayBalance converted to the book base currency (TRY) at the latest known TCMB rate; equal to displayBalance for a TRY account, "0" when a foreign account has no rate yet. */
  displayBalanceTry: MoneyString;
  /** Magnitude of the account's live opening-balance posting in its own currency; "0" when the account has none. Editable through UpdateAccountRequest. */
  openingBalance: MoneyString;
  availableCredit: MoneyString | null;
}

export type AccountListResponse = ItemListResponse<AccountDTO>;
export type AccountBalanceResponse = AccountDTO;

export interface ListAccountsQuery {
  bookId: UUID;
  includeArchived?: boolean;
}

export interface CreateAccountRequest {
  bookId: UUID;
  name: string;
  accountTypeId: UUID;
  normalBalance?: Direction;
  currencyCode: CurrencyCode;
  allowNegativeBalance?: boolean;
  creditLimit?: MoneyString | null;
  openingBalance?: MoneyString;
  isArchived?: boolean;
  sortOrder?: number;
}

export interface UpdateAccountRequest {
  name?: string;
  accountTypeId?: UUID;
  allowNegativeBalance?: boolean;
  creditLimit?: MoneyString | null;
  /** New opening-balance magnitude in the account's own currency. When it differs from the current one, the live opening posting is reversed and re-posted. "0" removes it. */
  openingBalance?: MoneyString;
  isArchived?: boolean;
  sortOrder?: number;
  version: Version;
}

export type CreateAccountResponse = AccountDTO;
export type UpdateAccountResponse = AccountDTO;

export interface ArchivedAccountResponse {
  id: UUID;
  isArchived: true;
  version: Version;
}

export type DeleteAccountResponse = DeletedEntityResponse | ArchivedAccountResponse;
