import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { createInstallmentExpense, realizeScheduled } from "../../src/modules/scheduled-transactions/scheduled.service";
import { getAccountStatement } from "../../src/modules/accounts/account.service";
import { createTransaction } from "../../src/modules/transactions/transaction.service";

const connectionString = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!connectionString);
const migrationsDirectory = fileURLToPath(
  new URL("../../../../packages/database/migrations/", import.meta.url),
);

let schema: string;
let pool: pg.Pool;
let ownerId: string;
let bookId: string;
let bankAccountId: string;
let cardAccountId: string;
let categoryId: string;

async function cardBalance(): Promise<number> {
  const result = await pool.query<{ balance: string }>(
    `SELECT COALESCE(SUM(CASE WHEN e.direction='CREDIT' THEN e.amount ELSE -e.amount END),0)::text AS balance
     FROM transaction_entries e JOIN transactions t ON t.id=e.transaction_id AND t.status IN ('POSTED','REVERSED')
     WHERE e.account_id=$1`,
    [cardAccountId],
  );
  return Number(result.rows[0]!.balance);
}

suite("PostgreSQL installment-expense integration", () => {
  beforeAll(async () => {
    schema = `test_${crypto.randomUUID().replaceAll("-", "")}`;
    const scoped = new URL(connectionString!);
    scoped.searchParams.set("options", `-c search_path=${schema},public`);

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

    const owner = await admin.query<{ id: string }>(
      `INSERT INTO users(email,display_name,status)
       VALUES('owner@example.com','Hesap Sahibi','ACTIVE') RETURNING id`,
    );
    ownerId = owner.rows[0]!.id;

    const book = await admin.query<{ id: string }>(
      `INSERT INTO books(name,book_type,base_currency,owner_user_id)
       VALUES('Sahip Defteri','PERSONAL','TRY',$1) RETURNING id`,
      [ownerId],
    );
    bookId = book.rows[0]!.id;
    await admin.query(
      `INSERT INTO book_members(book_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
      [bookId, ownerId],
    );
    await admin.query(`SELECT seed_default_account_types($1)`, [bookId]);
    await admin.query(`SELECT seed_default_categories($1,'TRY')`, [bookId]);

    const equity = await admin.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Opening Equity',(SELECT id FROM account_types WHERE book_id=$1 AND purpose='SYSTEM_EQUITY'),'CREDIT','TRY',true)
       RETURNING id`,
      [bookId],
    );
    const systemEquityAccountId = equity.rows[0]!.id;

    const bank = await admin.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Banka',(SELECT id FROM account_types WHERE book_id=$1 AND name='Banka'),'DEBIT','TRY',false)
       RETURNING id`,
      [bookId],
    );
    bankAccountId = bank.rows[0]!.id;
    // The balance-check trigger is DEFERRABLE INITIALLY DEFERRED, so it fires at
    // end-of-transaction - these two inserts must share one explicit transaction,
    // or the trigger sees the posting before its entries exist and rejects it.
    await admin.query("BEGIN");
    const opening = await admin.query<{ id: string }>(
      `INSERT INTO transactions(book_id,transaction_type,account_id,title,transaction_date,status,currency_code,client_operation_id,created_by)
       VALUES($1,'OPENING_BALANCE',$2,'Açılış',now(),'POSTED','TRY',gen_random_uuid(),$3) RETURNING id`,
      [bookId, bankAccountId, ownerId],
    );
    await admin.query(
      `INSERT INTO transaction_entries(transaction_id,account_id,direction,amount,currency_code,base_amount)
       VALUES($1,$2,'DEBIT',5000,'TRY',5000),($1,$3,'CREDIT',5000,'TRY',5000)`,
      [opening.rows[0]!.id, bankAccountId, systemEquityAccountId],
    );
    await admin.query("COMMIT");

    const card = await admin.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system,
         allow_negative_balance,credit_limit,statement_day,payment_due_offset_days)
       VALUES($1,'Kredi Kartı',(SELECT id FROM account_types WHERE book_id=$1 AND name='Kredi Kartı'),'CREDIT','TRY',false,
         true,5000,10,10)
       RETURNING id`,
      [bookId],
    );
    cardAccountId = card.rows[0]!.id;

    const category = await admin.query<{ id: string }>(
      `SELECT id FROM categories WHERE book_id=$1 AND category_type='EXPENSE' LIMIT 1`,
      [bookId],
    );
    categoryId = category.rows[0]!.id;

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

  it("rejects an account with no statement cycle configured", async () => {
    await expect(
      createInstallmentExpense(pool, ownerId, {
        bookId, accountId: bankAccountId, fundingAccountId: cardAccountId, categoryId,
        title: "Taksit denemesi", amount: "100", currencyCode: "TRY",
        transactionDate: "2026-03-05T12:00:00.000Z", installmentCount: 2,
        clientOperationId: crypto.randomUUID(),
      }),
    ).rejects.toMatchObject({ code: "STATEMENT_CYCLE_NOT_CONFIGURED" });
  });

  it("posts the full purchase today and schedules each installment on the card's statement cycle", async () => {
    const before = await cardBalance();
    const result = await createInstallmentExpense(pool, ownerId, {
      bookId, accountId: cardAccountId, fundingAccountId: bankAccountId, categoryId,
      title: "Televizyon", amount: "1000", currencyCode: "TRY",
      transactionDate: "2026-03-05T12:00:00.000Z", installmentCount: 3,
      clientOperationId: crypto.randomUUID(),
    });

    expect(result.transaction.type).toBe("EXPENSE");
    expect(Number(result.transaction.amount)).toBe(1000);
    // The full purchase hits the card's debt immediately, regardless of installments.
    expect(await cardBalance()).toBe(before + 1000);

    expect(result.scheduledTransactions).toHaveLength(3);
    const amounts = result.scheduledTransactions.map((item: any) => Number(item.amount));
    expect(amounts.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1000, 6);
    const dueDates = result.scheduledTransactions.map((item: any) => new Date(item.scheduledAt).toISOString().slice(0, 10));
    // Purchased on the 5th, before the 10th statement day: first installment closes this month.
    expect(dueDates).toEqual(["2026-03-20", "2026-04-20", "2026-05-20"]);
    for (const plan of result.scheduledTransactions as any[]) {
      expect(plan.transactionType).toBe("TRANSFER");
      expect(plan.accountId).toBe(bankAccountId);
      expect(plan.targetAccountId).toBe(cardAccountId);
      expect(plan.status).toBe("PENDING");
    }
  });

  it("realizing one installment pays down the card's debt from the funding account", async () => {
    const before = await cardBalance();
    const result = await createInstallmentExpense(pool, ownerId, {
      bookId, accountId: cardAccountId, fundingAccountId: bankAccountId, categoryId,
      title: "Buzdolabı", amount: "900", currencyCode: "TRY",
      transactionDate: "2026-04-01T12:00:00.000Z", installmentCount: 3,
      clientOperationId: crypto.randomUUID(),
    });
    expect(await cardBalance()).toBe(before + 900);

    const firstPlan = result.scheduledTransactions[0] as any;
    await realizeScheduled(pool, ownerId, firstPlan.id, {
      version: firstPlan.version,
      clientOperationId: crypto.randomUUID(),
    });

    // Paying the first installment reduces the card's debt by exactly that share.
    expect(await cardBalance()).toBe(before + 900 - 300);
  });

  it("rejects a statement request for an account with no statement cycle configured", async () => {
    await expect(getAccountStatement(pool, bankAccountId)).rejects.toMatchObject({ code: "STATEMENT_CYCLE_NOT_CONFIGURED" });
  });

  it("separates a one-shot purchase from an installment plan's own origin posting in the same period", async () => {
    // Dated well clear of the other tests' own installment due dates in this
    // shared book (2026-03-20..2026-06-20), so the two scenarios can't collide.
    await createTransaction(pool, ownerId, {
      bookId, type: "EXPENSE", accountId: cardAccountId, categoryId,
      title: "Tek çekim kahve makinesi", amount: "150", currencyCode: "TRY",
      transactionDate: "2026-09-05T12:00:00.000Z", clientOperationId: crypto.randomUUID(),
    });
    await createInstallmentExpense(pool, ownerId, {
      bookId, accountId: cardAccountId, fundingAccountId: bankAccountId, categoryId,
      title: "Laptop", amount: "300", currencyCode: "TRY",
      transactionDate: "2026-09-05T12:00:00.000Z", installmentCount: 3,
      clientOperationId: crypto.randomUUID(),
    });

    // Statement closing 2026-09-10: the one-shot purchase (in the closing
    // window) plus the installment's first share (due 2026-09-20), but never
    // the installment's own 300 origin posting.
    const september: any = await getAccountStatement(pool, cardAccountId, "2026-09");
    expect(september.closingDate.slice(0, 10)).toBe("2026-09-10");
    expect(september.dueDate.slice(0, 10)).toBe("2026-09-20");
    expect(september.items.find((item: any) => item.title === "Laptop")).toBeUndefined();
    const onePayment = september.items.find((item: any) => item.title === "Tek çekim kahve makinesi");
    expect(onePayment?.kind).toBe("PURCHASE");
    expect(Number(onePayment?.amount)).toBe(150);
    const installmentShare = september.items.find((item: any) => item.title === "Laptop (taksit 1/3)");
    expect(Number(installmentShare?.amount)).toBe(100);
    expect(installmentShare?.status).toBe("PENDING");
    expect(Number(september.total)).toBe(250);

    // The next statement only carries the installment's second share.
    const october: any = await getAccountStatement(pool, cardAccountId, "2026-10");
    expect(october.items.find((item: any) => item.title === "Laptop (taksit 2/3)")).toMatchObject({ kind: "INSTALLMENT", status: "PENDING" });
    expect(Number(october.items.find((item: any) => item.title === "Laptop (taksit 2/3)")?.amount)).toBe(100);
  });

  it("shows a partial payment truthfully: the actual amount paid, the original plan, and an unchanged statement total", async () => {
    // 2027 dates: clear of every other test's installment due dates in this
    // shared book (2026-03-20..2026-11-20), so this period holds only this item.
    const result = await createInstallmentExpense(pool, ownerId, {
      bookId, accountId: cardAccountId, fundingAccountId: bankAccountId, categoryId,
      title: "Çamaşır makinesi", amount: "200", currencyCode: "TRY",
      transactionDate: "2027-01-05T12:00:00.000Z", installmentCount: 2,
      clientOperationId: crypto.randomUUID(),
    });
    const firstPlan = result.scheduledTransactions[0] as any;
    // Pays only 60 of the planned 100 share - a genuine partial payment.
    await realizeScheduled(pool, ownerId, firstPlan.id, {
      version: firstPlan.version, amount: "60", clientOperationId: crypto.randomUUID(),
    });

    const january: any = await getAccountStatement(pool, cardAccountId, "2027-01");
    expect(january.items).toHaveLength(1);
    const share = january.items[0];
    expect(share.title).toBe("Çamaşır makinesi (taksit 1/2)");
    expect(share.status).toBe("COMPLETED");
    expect(Number(share.amount)).toBe(60);
    expect(Number(share.plannedAmount)).toBe(100);
    // The statement's own total still reflects what was actually billed, not what got paid.
    expect(Number(january.total)).toBe(100);
  });
});
