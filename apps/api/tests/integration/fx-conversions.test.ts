import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { createFxConversion } from "../../src/modules/fx/fx.service";
import {
  createAssetType,
  createInstrument,
  createLot,
  createSale,
  listBrokerageAccounts,
} from "../../src/modules/investments/investment.service";
import { reverseTransaction } from "../../src/modules/transactions/transaction.service";

const connectionString = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!connectionString);
const migrationsDirectory = fileURLToPath(
  new URL("../../../../packages/database/migrations/", import.meta.url),
);

let schema: string;
let pool: pg.Pool;
let userId: string;
let bookId: string;
let tryAccountId: string;
let usdBrokerageId: string;

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

async function baseLegs(transactionId: string): Promise<{ debit: number; credit: number }> {
  const result = await pool.query<{ direction: string; base_amount: string }>(
    `SELECT direction,base_amount::text FROM transaction_entries WHERE transaction_id=$1`,
    [transactionId],
  );
  let debit = 0;
  let credit = 0;
  for (const row of result.rows) {
    if (row.direction === "DEBIT") debit += Number(row.base_amount);
    else credit += Number(row.base_amount);
  }
  return { debit, credit };
}

suite("PostgreSQL FX-conversion integration", () => {
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
       VALUES('fx-conversion@example.com','FX Conversion','ACTIVE') RETURNING id`,
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
    await admin.query(`SELECT seed_default_investment_types($1)`, [bookId]);
    await admin.query(`INSERT INTO book_currencies(book_id,currency_code) VALUES($1,'USD')`, [bookId]);
    await admin.query(
      `INSERT INTO currency_daily_rates(currency_code,rate_date,try_rate) VALUES('USD',CURRENT_DATE,35)`,
    );

    const accounts = await admin.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Ziraat TL',(SELECT id FROM account_types WHERE book_id=$1 AND name='Nakit'),'DEBIT','TRY',false),
             ($1,'Piapiri USD',(SELECT id FROM account_types WHERE book_id=$1 AND name='Birikim'),'DEBIT','USD',false)
       RETURNING id`,
      [bookId],
    );
    tryAccountId = accounts.rows[0]!.id;
    usdBrokerageId = accounts.rows[1]!.id;

    const equity = await admin.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Opening Equity',(SELECT id FROM account_types WHERE book_id=$1 AND purpose='SYSTEM_EQUITY'),'CREDIT','TRY',true)
       RETURNING id`,
      [bookId],
    );
    const opening = await admin.query<{ id: string }>(
      `INSERT INTO transactions(book_id,transaction_type,account_id,title,transaction_date,status,currency_code,client_operation_id,created_by)
       VALUES($1,'OPENING_BALANCE',$2,'Ziraat açılış',now(),'POSTED','TRY',gen_random_uuid(),$3) RETURNING id`,
      [bookId, tryAccountId, userId],
    );
    await admin.query(
      `INSERT INTO transaction_entries(transaction_id,account_id,direction,amount,currency_code,base_amount)
       VALUES($1,$2,'DEBIT',500000,'TRY',500000),($1,$3,'CREDIT',500000,'TRY',500000)`,
      [opening.rows[0]!.id, tryAccountId, equity.rows[0]!.id],
    );

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

  it("buys foreign cash as a balanced cross-currency posting and reverses cleanly", async () => {
    const beforeTry = await nativeBalance(tryAccountId);
    const conversion = await createFxConversion(pool, userId, {
      bookId,
      fromAccountId: tryAccountId,
      toAccountId: usdBrokerageId,
      fromAmount: "35240",
      toAmount: "1000",
      transactionDate: new Date().toISOString(),
      notes: null,
      clientOperationId: crypto.randomUUID(),
    });
    expect(conversion).toMatchObject({
      toAmount: "1000",
      tryAmount: "35240",
      fromCurrency: "TRY",
      toCurrency: "USD",
    });

    expect(await nativeBalance(usdBrokerageId)).toBeCloseTo(1000, 6);
    expect(await nativeBalance(tryAccountId)).toBeCloseTo(beforeTry - 35240, 6);
    const legs = await baseLegs(conversion.id);
    expect(legs.debit).toBeCloseTo(35240, 6);
    expect(legs.credit).toBeCloseTo(35240, 6);

    await reverseTransaction(pool, userId, bookId, conversion.id, crypto.randomUUID(), "test geri al");
    expect(await nativeBalance(usdBrokerageId)).toBeCloseTo(0, 6);
    expect(await nativeBalance(tryAccountId)).toBeCloseTo(beforeTry, 6);
  });

  it("rejects a conversion that does not touch two distinct accounts", async () => {
    await expect(
      createFxConversion(pool, userId, {
        bookId,
        fromAccountId: usdBrokerageId,
        toAccountId: usdBrokerageId,
        fromAmount: "10",
        toAmount: "10",
        transactionDate: new Date().toISOString(),
        notes: null,
        clientOperationId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "FX_SAME_ACCOUNT" });
  });

  it("buys and sells a foreign-currency instrument through the matching brokerage account", async () => {
    await createFxConversion(pool, userId, {
      bookId,
      fromAccountId: tryAccountId,
      toAccountId: usdBrokerageId,
      fromAmount: "70000",
      toAmount: "2000",
      transactionDate: new Date().toISOString(),
      notes: null,
      clientOperationId: crypto.randomUUID(),
    });
    const funded = await nativeBalance(usdBrokerageId);

    const assetType = await createAssetType(pool, userId, { bookId, name: "US Hisse", icon: null, sortOrder: 5 });
    const instrument = await createInstrument(pool, userId, {
      bookId, assetTypeId: assetType.id, name: "Apple", symbol: "AAPL", currencyCode: "USD",
    });
    const lot = await createLot(pool, userId, {
      bookId, instrumentId: instrument.id, accountId: usdBrokerageId,
      quantity: "5", unitPrice: "100", purchasedAt: new Date().toISOString(), notes: null,
    });
    expect(lot).toMatchObject({ posted: true, currencyCode: "USD" });
    // 5 * 100 = 500 USD left the brokerage account (the balance trigger already
    // proved the cross-currency posting balanced in base_amount).
    expect(await nativeBalance(usdBrokerageId)).toBeCloseTo(funded - 500, 6);

    const sale = await createSale(pool, userId, {
      bookId, instrumentId: instrument.id, destinationAccountId: usdBrokerageId,
      quantity: "5", unitPrice: "120", soldAt: new Date().toISOString(), notes: null,
      clientOperationId: crypto.randomUUID(),
    });
    expect(sale).toMatchObject({ currencyCode: "USD" });
    expect(await nativeBalance(usdBrokerageId)).toBeCloseTo(funded - 500 + 600, 6);
  });

  it("lists the USD brokerage account with a TRY-converted balance", async () => {
    const rows = (await listBrokerageAccounts(pool, bookId)).items as Array<{
      name: string; currencyCode: string; displayBalance: string; displayBalanceTry: string;
    }>;
    const usd = rows.find((row) => row.name === "Piapiri USD")!;
    expect(usd.currencyCode).toBe("USD");
    expect(Number(usd.displayBalanceTry)).toBeCloseTo(Number(usd.displayBalance) * 35, 2);
  });
});
