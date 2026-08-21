import { AppError } from "../../common/errors";
import type { DbClient } from "../../infrastructure/database";

export type SystemAccountPurpose =
  | "SYSTEM_INCOME"
  | "SYSTEM_EXPENSE"
  | "SYSTEM_EQUITY"
  | "CUSTOMER"
  | "SUPPLIER"
  | "OTHER";

/** The book's account_types row for a stable system purpose (id + normal_balance), used when creating an account/hidden category account that must carry that role. */
export async function getSystemAccountType(client: DbClient, bookId: string, purpose: SystemAccountPurpose) {
  const result = await client.query<{ id: string; normal_balance: "DEBIT" | "CREDIT" }>(
    `SELECT id,normal_balance FROM account_types WHERE book_id=$1 AND purpose=$2 AND deleted_at IS NULL LIMIT 1`,
    [bookId, purpose],
  );
  if (!result.rows[0]) throw new AppError(500, "ACCOUNT_TYPE_MISSING", `No account type configured for ${purpose}`);
  return result.rows[0];
}

/** The book's single ledger account carrying a stable system purpose (e.g. its SYSTEM_EQUITY account). Throws if missing. */
export async function getSystemAccountId(client: DbClient, bookId: string, purpose: SystemAccountPurpose) {
  const result = await client.query<{ id: string }>(
    `SELECT a.id FROM accounts a JOIN account_types t ON t.id=a.account_type_id
     WHERE a.book_id=$1 AND t.purpose=$2 AND a.deleted_at IS NULL LIMIT 1`,
    [bookId, purpose],
  );
  if (!result.rows[0]) throw new AppError(500, "EQUITY_ACCOUNT_MISSING", `No account exists for ${purpose}`);
  return result.rows[0].id;
}

/** Same lookup as getSystemAccountId, but resolves to undefined instead of throwing when missing. */
export async function findSystemAccountId(client: DbClient, bookId: string, purpose: SystemAccountPurpose) {
  const result = await client.query<{ id: string }>(
    `SELECT a.id FROM accounts a JOIN account_types t ON t.id=a.account_type_id
     WHERE a.book_id=$1 AND t.purpose=$2 AND a.deleted_at IS NULL LIMIT 1`,
    [bookId, purpose],
  );
  return result.rows[0]?.id;
}
