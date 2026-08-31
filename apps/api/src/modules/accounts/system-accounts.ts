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

/**
 * The book's hidden SYSTEM_EQUITY account for a given currency, creating it on
 * first use. The base-currency (TRY) account is seeded with the book, so this
 * only ever inserts for a foreign currency the book started investing/holding
 * in. Every SYSTEM_EQUITY entry must match its account's currency, so FX-aware
 * postings resolve their contra account through here.
 */
export async function resolveSystemEquityAccountId(client: DbClient, bookId: string, currencyCode: string) {
  const existing = await client.query<{ id: string }>(
    `SELECT a.id FROM accounts a JOIN account_types t ON t.id=a.account_type_id
     WHERE a.book_id=$1 AND t.purpose='SYSTEM_EQUITY' AND a.currency_code=$2 AND a.deleted_at IS NULL LIMIT 1`,
    [bookId, currencyCode],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const type = await getSystemAccountType(client, bookId, "SYSTEM_EQUITY");
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
     VALUES($1,$2,$3,'CREDIT',$4,true) RETURNING id`,
    [bookId, `Opening Equity (${currencyCode})`, type.id, currencyCode],
  );
  return inserted.rows[0]!.id;
}
