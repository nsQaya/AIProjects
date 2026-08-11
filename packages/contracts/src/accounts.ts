import type {
  CurrencyCode,
  DeletedEntityResponse,
  Direction,
  ItemListResponse,
  MoneyString,
  UUID,
  Version,
} from "./common.js";

export type AccountType =
  | "CASH"
  | "BANK"
  | "CREDIT_CARD"
  | "CUSTOMER"
  | "SUPPLIER"
  | "RECEIVABLE"
  | "PAYABLE"
  | "SAVINGS"
  | "BUDGET"
  | "PERSONNEL"
  | "OTHER";

export interface AccountDTO {
  id: UUID;
  bookId: UUID;
  contactId: UUID | null;
  name: string;
  accountType: AccountType;
  normalBalance: Direction;
  currencyCode: CurrencyCode;
  allowNegativeBalance: boolean;
  creditLimit: MoneyString | null;
  isArchived: boolean;
  sortOrder: number;
  version: Version;
  /** Ledger-sign balance, before display normalization for credit-normal accounts. */
  balance: MoneyString;
  /** User-facing balance; credit-normal balances are sign-inverted by the server. */
  displayBalance: MoneyString;
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
  accountType: AccountType;
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
  accountType?: AccountType;
  allowNegativeBalance?: boolean;
  creditLimit?: MoneyString | null;
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
