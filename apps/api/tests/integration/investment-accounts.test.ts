import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  createAssetType,
  createCapitalIncrease,
  createInstrument,
  createLot,
  createSale,
  deleteLot,
  listLots,
  portfolio,
  updateLot,
} from "../../src/modules/investments/investment.service";

const connectionString = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!connectionString);
const migrationsDirectory = fileURLToPath(
  new URL("../../../../packages/database/migrations/", import.meta.url),
);

let schema: string;
let pool: pg.Pool;
let userId: string;
let bookId: string;
let brokerageAccountId: string;
let cashAccountId: string;
let instrumentId: string;

async function balance(accountId: string): Promise<string> {
  const result = await pool.query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0)::text AS balance
     FROM transaction_entries e
     JOIN transactions t ON t.id=e.transaction_id AND t.status IN ('POSTED','REVERSED')
     WHERE e.account_id=$1`,
    [accountId],
  );
  return result.rows[0]!.balance;
}

suite("PostgreSQL investment-account integration", () => {
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
       VALUES('investment-account@example.com','Investment Account','ACTIVE') RETURNING id`,
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
    const accounts = await admin.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Piapiri TL',(SELECT id FROM account_types WHERE book_id=$1 AND name='Birikim'),'DEBIT','TRY',false),
             ($1,'Cüzdan',(SELECT id FROM account_types WHERE book_id=$1 AND name='Nakit'),'DEBIT','TRY',false)
       RETURNING id`,
      [bookId],
    );
    brokerageAccountId = accounts.rows[0]!.id;
    cashAccountId = accounts.rows[1]!.id;

    // createBookWithClient normally seeds the hidden equity account; this test
    // builds the book by hand, so add it plus opening cash in the brokerage.
    const equity = await admin.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Opening Equity',(SELECT id FROM account_types WHERE book_id=$1 AND purpose='SYSTEM_EQUITY'),'CREDIT','TRY',true)
       RETURNING id`,
      [bookId],
    );
    const opening = await admin.query<{ id: string }>(
      `INSERT INTO transactions(book_id,transaction_type,account_id,title,transaction_date,status,currency_code,client_operation_id,created_by)
       VALUES($1,'OPENING_BALANCE',$2,'Piapiri açılış',now(),'POSTED','TRY',gen_random_uuid(),$3) RETURNING id`,
      [bookId, brokerageAccountId, userId],
    );
    await admin.query(
      `INSERT INTO transaction_entries(transaction_id,account_id,direction,amount,currency_code,base_amount)
       VALUES($1,$2,'DEBIT',100000,'TRY',100000),($1,$3,'CREDIT',100000,'TRY',100000)`,
      [opening.rows[0]!.id, brokerageAccountId, equity.rows[0]!.id],
    );

    await admin.end();
    pool = new pg.Pool({ connectionString, options: `-c search_path=${schema},public` });

    const assetType = await createAssetType(pool, userId, {
      bookId,
      name: "Elle Hisse",
      icon: null,
      sortOrder: 0,
    });
    const instrument = await createInstrument(pool, userId, {
      bookId,
      assetTypeId: assetType.id,
      name: "Test A.Ş.",
      symbol: "TESTA",
      currencyCode: "TRY",
    });
    instrumentId = instrument.id;
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

  it("marks the seeded Birikim account type as an investment account", async () => {
    const row = await pool.query<{ is_investment: boolean }>(
      `SELECT is_investment FROM account_types WHERE book_id=$1 AND name='Birikim'`,
      [bookId],
    );
    expect(row.rows[0]!.is_investment).toBe(true);
    const cash = await pool.query<{ is_investment: boolean }>(
      `SELECT is_investment FROM account_types WHERE book_id=$1 AND name='Nakit'`,
      [bookId],
    );
    expect(cash.rows[0]!.is_investment).toBe(false);
  });

  it("rejects a purchase lot whose account is not an investment account", async () => {
    await expect(
      createLot(pool, userId, {
        bookId,
        instrumentId,
        accountId: cashAccountId,
        quantity: "10",
        unitPrice: "25.50",
        purchasedAt: new Date().toISOString(),
        notes: null,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_INVESTMENT" });
  });

  it("posts the cash side of a purchase and drops the brokerage balance", async () => {
    const before = await balance(brokerageAccountId);
    const lot = await createLot(pool, userId, {
      bookId,
      instrumentId,
      accountId: brokerageAccountId,
      quantity: "10",
      unitPrice: "25.50",
      purchasedAt: new Date().toISOString(),
      notes: null,
    });
    expect(lot).toMatchObject({ accountId: brokerageAccountId, quantity: "10", posted: true });
    // 10 * 25.50 = 255 left the brokerage account
    expect(Number(await balance(brokerageAccountId))).toBeCloseTo(Number(before) - 255, 4);
    await deleteLot(pool, userId, lot.id, lot.version);
    expect(Number(await balance(brokerageAccountId))).toBeCloseTo(Number(before), 4);
  });

  it("keeps an account-less purchase unposted", async () => {
    const lot = await createLot(pool, userId, {
      bookId,
      instrumentId,
      quantity: "3",
      unitPrice: "10",
      purchasedAt: new Date().toISOString(),
      notes: null,
    });
    expect(lot.posted).toBe(false);
    await deleteLot(pool, userId, lot.id, lot.version);
  });

  it("rejects buying more than the brokerage account holds", async () => {
    await expect(
      createLot(pool, userId, {
        bookId,
        instrumentId,
        accountId: brokerageAccountId,
        quantity: "100000",
        unitPrice: "10",
        purchasedAt: new Date().toISOString(),
        notes: null,
      }),
    ).rejects.toMatchObject({ code: "NEGATIVE_BALANCE_NOT_ALLOWED" });
  });

  it("rejects a purchase when instrument and account currencies differ", async () => {
    await pool.query(`INSERT INTO book_currencies(book_id,currency_code) VALUES($1,'USD') ON CONFLICT DO NOTHING`, [bookId]);
    const usdType = await createAssetType(pool, userId, { bookId, name: "USD Hisse", icon: null, sortOrder: 1 });
    const usdInstrument = await createInstrument(pool, userId, {
      bookId, assetTypeId: usdType.id, name: "US Co", symbol: "USCO", currencyCode: "USD",
    });
    await expect(
      createLot(pool, userId, {
        bookId,
        instrumentId: usdInstrument.id,
        accountId: brokerageAccountId,
        quantity: "1",
        unitPrice: "10",
        purchasedAt: new Date().toISOString(),
        notes: null,
      }),
    ).rejects.toMatchObject({ code: "INVESTMENT_CURRENCY_MISMATCH" });
  });

  it("rejects a sale whose destination account is not an investment account", async () => {
    await expect(
      createSale(pool, userId, {
        bookId,
        instrumentId,
        destinationAccountId: cashAccountId,
        quantity: "1",
        unitPrice: "30",
        soldAt: new Date().toISOString(),
        notes: null,
        clientOperationId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_INVESTMENT" });
  });

  it("adds a bonus issue as a zero-cost capital increase that lowers the average cost", async () => {
    const buy = await createLot(pool, userId, {
      bookId, instrumentId, accountId: brokerageAccountId,
      quantity: "10", unitPrice: "20", purchasedAt: "2026-02-01T09:00:00.000Z", notes: null,
    });
    const beforeBalance = await balance(brokerageAccountId);
    const bonus = await createCapitalIncrease(pool, userId, {
      bookId, instrumentId, newTotalQuantity: "20", amountPaid: "0",
      accountId: null, effectiveAt: "2026-03-01T09:00:00.000Z", notes: null,
    });
    expect(bonus).toMatchObject({ kind: "CAPITAL_INCREASE", quantity: "10", posted: false });
    expect(await balance(brokerageAccountId)).toBe(beforeBalance); // no cash moved
    const position = (await portfolio(pool, bookId)).items.find((row) => row.instrumentId === instrumentId)!;
    expect(Number(position.quantity)).toBe(20);
    expect(Number(position.costBasis)).toBeCloseTo(200, 4); // 10*20, unchanged
    await deleteLot(pool, userId, bonus.id, bonus.version);
    await deleteLot(pool, userId, buy.id, buy.version);
  });

  it("posts the cash for a paid (bedelli) capital increase and rejects an unfunded one", async () => {
    const buy = await createLot(pool, userId, {
      bookId, instrumentId, accountId: brokerageAccountId,
      quantity: "10", unitPrice: "20", purchasedAt: "2026-02-01T09:00:00.000Z", notes: null,
    });
    await expect(
      createCapitalIncrease(pool, userId, {
        bookId, instrumentId, newTotalQuantity: "15", amountPaid: "500",
        accountId: null, effectiveAt: "2026-03-01T09:00:00.000Z", notes: null,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_REQUIRED_FOR_PAID_INCREASE" });
    const before = await balance(brokerageAccountId);
    const rights = await createCapitalIncrease(pool, userId, {
      bookId, instrumentId, newTotalQuantity: "15", amountPaid: "500",
      accountId: brokerageAccountId, effectiveAt: "2026-03-01T09:00:00.000Z", notes: null,
    });
    expect(rights).toMatchObject({ kind: "CAPITAL_INCREASE", quantity: "5", posted: true });
    expect(Number(await balance(brokerageAccountId))).toBeCloseTo(Number(before) - 500, 4);
    await deleteLot(pool, userId, rights.id, rights.version);
    expect(Number(await balance(brokerageAccountId))).toBeCloseTo(Number(before), 4);
    await deleteLot(pool, userId, buy.id, buy.version);
  });

  it("rejects a capital increase that does not raise the position and blocks editing one", async () => {
    const buy = await createLot(pool, userId, {
      bookId, instrumentId, accountId: brokerageAccountId,
      quantity: "10", unitPrice: "20", purchasedAt: "2026-02-01T09:00:00.000Z", notes: null,
    });
    await expect(
      createCapitalIncrease(pool, userId, {
        bookId, instrumentId, newTotalQuantity: "10", amountPaid: "0",
        accountId: null, effectiveAt: "2026-03-01T09:00:00.000Z", notes: null,
      }),
    ).rejects.toMatchObject({ code: "CAPITAL_INCREASE_NOT_POSITIVE" });
    const bonus = await createCapitalIncrease(pool, userId, {
      bookId, instrumentId, newTotalQuantity: "20", amountPaid: "0",
      accountId: null, effectiveAt: "2026-03-01T09:00:00.000Z", notes: null,
    });
    await expect(
      updateLot(pool, userId, bonus.id, { quantity: "5", version: bonus.version }),
    ).rejects.toMatchObject({ code: "CAPITAL_INCREASE_IMMUTABLE" });
    await deleteLot(pool, userId, bonus.id, bonus.version);
    await deleteLot(pool, userId, buy.id, buy.version);
  });
});
