import type { BookRole } from "@defterx/contracts";
import { AppError } from "../common/errors";
import type { DbClient } from "../infrastructure/database";
import { bookRoleRank } from "./book-access";

/**
 * How much a user may do with a single account.
 *   MANAGE  - book EDITOR+ on the account's book (own the account: settings, sharing, any posting)
 *   OPERATE - an active OPERATE share: post income/expense, reverse own postings
 *   VIEW    - book VIEWER/ACCOUNTANT, or an active VIEW share: read the account and its ledger
 *   NONE    - no access
 */
export type AccountAccessLevel = "NONE" | "VIEW" | "OPERATE" | "MANAGE";

const accessRank: Record<AccountAccessLevel, number> = { NONE: 0, VIEW: 1, OPERATE: 2, MANAGE: 3 };

export interface AccountAccess {
  bookId: string;
  currencyCode: string;
  isSystem: boolean;
  contactId: string | null;
  level: AccountAccessLevel;
}

export async function resolveAccountAccess(
  db: DbClient,
  accountId: string,
  userId: string,
): Promise<AccountAccess> {
  const account = await db.query<{
    book_id: string;
    currency_code: string;
    is_system: boolean;
    contact_id: string | null;
  }>(
    `SELECT book_id,currency_code,is_system,contact_id
     FROM accounts WHERE id=$1 AND deleted_at IS NULL`,
    [accountId],
  );
  const row = account.rows[0];
  if (!row) throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account was not found");

  const base = {
    bookId: row.book_id,
    currencyCode: row.currency_code,
    isSystem: row.is_system,
    contactId: row.contact_id,
  };

  const member = await db.query<{ role: BookRole }>(
    `SELECT role FROM book_members
     WHERE book_id=$1 AND user_id=$2 AND status='ACTIVE' AND deleted_at IS NULL`,
    [row.book_id, userId],
  );
  const role = member.rows[0]?.role;
  if (role) {
    return { ...base, level: bookRoleRank[role] >= bookRoleRank.EDITOR ? "MANAGE" : "VIEW" };
  }

  const share = await db.query<{ permission: "VIEW" | "OPERATE" }>(
    `SELECT permission FROM account_shares
     WHERE account_id=$1 AND grantee_user_id=$2 AND status='ACTIVE' AND deleted_at IS NULL`,
    [accountId, userId],
  );
  const permission = share.rows[0]?.permission;
  if (permission) return { ...base, level: permission };

  return { ...base, level: "NONE" };
}

export async function assertAccountAccess(
  db: DbClient,
  accountId: string,
  userId: string,
  minimum: Exclude<AccountAccessLevel, "NONE">,
): Promise<AccountAccess> {
  const access = await resolveAccountAccess(db, accountId, userId);
  if (accessRank[access.level] < accessRank[minimum]) {
    throw new AppError(403, "ACCOUNT_ACCESS_DENIED", "You do not have access to this account");
  }
  return access;
}

export function hasAccountLevel(
  access: AccountAccess,
  minimum: Exclude<AccountAccessLevel, "NONE">,
): boolean {
  return accessRank[access.level] >= accessRank[minimum];
}
