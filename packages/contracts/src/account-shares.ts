import type { AccountDTO } from "./accounts.js";
import type { CategoryDTO } from "./categories.js";
import type { CostCenterDTO } from "./cost-centers.js";
import type { CurrencyCode, ItemListResponse, UUID, Version } from "./common.js";

export type AccountSharePermission = "VIEW" | "OPERATE";
export type AccountShareStatus = "ACTIVE" | "REVOKED";

/** Owner-facing: one grantee an account is shared with. */
export interface AccountShareDTO {
  id: UUID;
  accountId: UUID;
  granteeUserId: UUID;
  granteeEmail: string;
  granteeDisplayName: string;
  permission: AccountSharePermission;
  status: AccountShareStatus;
  version: Version;
}

export type AccountShareListResponse = ItemListResponse<AccountShareDTO>;

/** Grantee-facing: an account someone else shared with the caller, with balance projection. */
export interface SharedWithMeAccountDTO extends AccountDTO {
  shareId: UUID;
  permission: AccountSharePermission;
  ownerBookId: UUID;
  ownerName: string;
  ownerEmail: string;
}

export type SharedWithMeListResponse = ItemListResponse<SharedWithMeAccountDTO>;

export interface ShareAccountRequest {
  email: string;
  permission: AccountSharePermission;
}

export type ShareAccountResponse = AccountShareDTO;

export interface UpdateAccountShareRequest {
  permission: AccountSharePermission;
  version: Version;
}

export type UpdateAccountShareResponse = AccountShareDTO;

export interface RevokedAccountShareResponse {
  id: UUID;
  status: "REVOKED";
  version: Version;
}

/**
 * References a grantee needs from the owner's book to post an OPERATE transaction
 * against the shared account (the transaction lands in the owner's ledger).
 */
export interface AccountPostingContextDTO {
  accountId: UUID;
  bookId: UUID;
  currencyCode: CurrencyCode;
  baseCurrency: CurrencyCode;
  categories: CategoryDTO[];
  costCenters: CostCenterDTO[];
}
