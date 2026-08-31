import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { createAccount, getAccountBalance, updateAccount } from "../../src/modules/accounts/account.service";

const connectionString = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!connectionString);
const migrationsDirectory = fileURLToPath(
  new URL("../../../../packages/database/migrations/", import.meta.url),
);

let schema: string;
let pool: pg.Pool;
let userId: string;
let bookId: string;
let bankTypeId: string;
let equityAccountId: string;

async function nativeBalance(accountId: string): Promise<number> {
  const result = await pool.query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.amount ELSE -e.amount END),0)::text AS balance
     FROM transaction_entries e
     JOIN transactions t ON t.id=e.transaction_id AND t.status IN ('POSTED','REVERSED')
     WHERE e.account_id=$1`,
    [accountId],
  );
  return Number(result.rows[0]!.balance);
}

async function livePostings(accountId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM transactions
     WHERE account_id=$1 AND transaction_type='OPENING_BALANCE' AND status='POSTED' AND deleted_at IS NULL`,
    [accountId],
  );
  return Number(result.rows[0]!.count);
}

/** Moves `amount` TRY out of the account into hidden equity, mimicking a spend. */
async function spend(accountId: string, amount: number): Promise<void> {
  const tx = await pool.query<{ id: string }>(
    `INSERT INTO transactions(book_id,transaction_type,account_id,title,transaction_date,status,currency_code,client_operation_id,created_by)
     VALUES($1,'ADJUSTMENT',$2,'Spend',now(),'POSTED','TRY',gen_random_uuid(),$3) RETURNING id`,
    [bookId, accountId, userId],
  );
  await pool.query(
    `INSERT INTO transaction_entries(transaction_id,account_id,direction,amount,currency_code,base_amount)
     VALUES($1,$2,'CREDIT',$4,'TRY',$4),($1,$3,'DEBIT',$4,'TRY',$4)`,
    [tx.rows[0]!.id, accountId, equityAccountId, String(amount)],
  );
}

suite("PostgreSQL account opening-balance edit integration", () => {
  beforeAll(async () => {
    schema = `test_${crypto.randomUUID().replaceAll("-", "")}`;
    const admin = new pg.Client({ connectionString });
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`SET search_path TO ${schema},public`);
    const migrations = (await readdir(migrationsDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    for (const filename of migrations) {
      await admin.query(await readFile(join(migrationsDirectory, filename), "utf8"));
    }
    const user = await admin.query<{ id: string }>(
      `INSERT INTO users(email,display_name,status)
       VALUES('opening-balance@example.com','Opening Balance','ACTIVE') RETURNING id`,
    );
    userId = user.rows[0]!.id;
    const book = await admin.query<{ id: string }>(
      `INSERT INTO books(name,book_type,base_currency,owner_user_id)
       VALUES('Primary','PERSONAL','TRY',$1) RETURNING id`,
      [userId],
    );
    bookId = book.rows[0]!.id;
    await admin.query(
      `INSERT INTO book_members(book_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
      [bookId, userId],
    );
    await admin.query(`SELECT seed_default_account_types($1)`, [bookId]);
    const bankType = await admin.query<{ id: string }>(
      `SELECT id FROM account_types WHERE book_id=$1 AND name='Banka'`,
      [bookId],
    );
    bankTypeId = bankType.rows[0]!.id;
    const equity = await admin.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Opening Equity',(SELECT id FROM account_types WHERE book_id=$1 AND purpose='SYSTEM_EQUITY'),'CREDIT','TRY',true)
       RETURNING id`,
      [bookId],
    );
    equityAccountId = equity.rows[0]!.id;

    await admin.end();
    pool = new pg.Pool({ connectionString, options: `-c search_path=${schema},public` });
  }, 120000);

  afterAll(async () => {
    if (pool) await pool.end();
    if (connectionString && schema) {
      const cleanup = new pg.Client({ connectionString });
      await cleanup.connect();
      await cleanup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await cleanup.end();
    }
  }, 120000);

  it("re-posts a single opening balance when it is raised", async () => {
    const created = await createAccount(pool, userId, {
      bookId, name: "Yükselen", accountTypeId: bankTypeId, currencyCode: "TRY",
      openingBalance: "1000", isArchived: false, sortOrder: 0,
    });
    expect(created.displayBalance).toBe("1000.000000");
    expect(created.openingBalance).toBe("1000.000000");

    const updated = await updateAccount(pool, userId, created.id, {
      openingBalance: "1500", version: created.version,
    });
    expect(updated.displayBalance).toBe("1500.000000");
    expect(updated.openingBalance).toBe("1500.000000");
    expect(await nativeBalance(created.id)).toBe(1500);
    expect(await livePostings(created.id)).toBe(1);
  });

  it("removes the opening posting when it is set to zero", async () => {
    const created = await createAccount(pool, userId, {
      bookId, name: "Sıfırlanan", accountTypeId: bankTypeId, currencyCode: "TRY",
      openingBalance: "750", isArchived: false, sortOrder: 0,
    });
    const updated = await updateAccount(pool, userId, created.id, {
      openingBalance: "0", version: created.version,
    });
    expect(updated.openingBalance).toBe("0");
    expect(await nativeBalance(created.id)).toBe(0);
    expect(await livePostings(created.id)).toBe(0);
  });

  it("is a no-op when the opening balance is unchanged", async () => {
    const created = await createAccount(pool, userId, {
      bookId, name: "Değişmeyen", accountTypeId: bankTypeId, currencyCode: "TRY",
      openingBalance: "300", isArchived: false, sortOrder: 0,
    });
    await updateAccount(pool, userId, created.id, {
      name: "Değişmeyen (yeni ad)", openingBalance: "300", version: created.version,
    });
    const transactions = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM transactions WHERE account_id=$1`,
      [created.id],
    );
    expect(Number(transactions.rows[0]!.count)).toBe(1);
    expect(await livePostings(created.id)).toBe(1);
  });

  it("rejects lowering the opening balance below what has already been spent", async () => {
    const created = await createAccount(pool, userId, {
      bookId, name: "Harcanmış", accountTypeId: bankTypeId, currencyCode: "TRY",
      openingBalance: "1000", isArchived: false, sortOrder: 0,
    });
    await spend(created.id, 800);
    expect(await nativeBalance(created.id)).toBe(200);

    await expect(
      updateAccount(pool, userId, created.id, { openingBalance: "100", version: created.version }),
    ).rejects.toMatchObject({ code: "NEGATIVE_BALANCE_NOT_ALLOWED" });

    const unchanged = await getAccountBalance(pool, created.id);
    expect(unchanged.openingBalance).toBe("1000.000000");
    expect(await nativeBalance(created.id)).toBe(200);
    expect(await livePostings(created.id)).toBe(1);
  });
});
