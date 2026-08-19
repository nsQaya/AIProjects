import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { readdir,readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadReportAnalytics } from "../../src/modules/reports/report.analytics";
import { createScheduled } from "../../src/modules/scheduled-transactions/scheduled.service";
import { createTransaction } from "../../src/modules/transactions/transaction.service";

// Regression coverage for a bug where the "Likidite tahmini" (liquidity forecast)
// report only summed *scheduled* (not-yet-posted) transactions across the whole
// window, ignoring already-posted transactions dated inside it. That made the
// projected period-end balance swing wildly depending on where the window's
// `from` date happened to fall relative to real, already-posted transactions
// (e.g. a backdated opening/carryover entry), even though `to` and the full set
// of transactions in scope were unchanged. See loadReportAnalytics's "liquidity"
// query (event_impacts/totals CTEs) in report.analytics.ts.

const connectionString = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!connectionString);
const migrationsDirectory = fileURLToPath(
  new URL("../../../../packages/database/migrations/",import.meta.url),
);

let schema: string;
let pool: pg.Pool;
let userId: string;
let bookId: string;
let cashId: string;
let expenseCategoryId: string;

suite("PostgreSQL liquidity forecast integration",()=>{
  beforeAll(async()=>{
    schema=`test_${crypto.randomUUID().replaceAll("-","")}`;
    const admin = new pg.Client({connectionString});
    await admin.connect();
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`SET search_path TO ${schema},public`);
    const migrations = (await readdir(migrationsDirectory))
      .filter(name=>name.endsWith(".sql"))
      .sort();
    for (const filename of migrations) {
      await admin.query(await readFile(join(migrationsDirectory,filename),"utf8"));
    }
    const user = await admin.query<{id:string}>(
      `INSERT INTO users(email,display_name,status)
       VALUES('liquidity@example.com','Liquidity','ACTIVE') RETURNING id`,
    );
    userId=user.rows[0]!.id;
    const book = await admin.query<{id:string}>(
      `INSERT INTO books(name,book_type,base_currency,owner_user_id)
       VALUES('Liquidity Book','PERSONAL','TRY',$1) RETURNING id`,
      [userId],
    );
    bookId=book.rows[0]!.id;
    await admin.query(
      `INSERT INTO book_members(book_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
      [bookId,userId],
    );
    const accounts = await admin.query<{id:string}>(
      `INSERT INTO accounts(book_id,name,account_type,normal_balance,currency_code,is_system)
       VALUES($1,'Cash','CASH','DEBIT','TRY',false),
             ($1,'Expense','SYSTEM_EXPENSE','DEBIT','TRY',true)
       RETURNING id`,
      [bookId],
    );
    cashId=accounts.rows[0]!.id;
    const category = await admin.query<{id:string}>(
      `INSERT INTO categories(book_id,name,category_type,system_account_id)
       VALUES($1,'Market','EXPENSE',$2) RETURNING id`,
      [bookId,accounts.rows[1]!.id],
    );
    expenseCategoryId=category.rows[0]!.id;
    await admin.end();
    pool=new pg.Pool({connectionString,options:`-c search_path=${schema},public`});
  },120000);

  afterAll(async()=>{
    if (pool) await pool.end();
    if (connectionString&&schema) {
      const cleanup = new pg.Client({connectionString});
      await cleanup.connect();
      await cleanup.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await cleanup.end();
    }
  },120000);

  it("keeps the projected period-end balance stable when `from` moves across an already-posted transaction",async()=>{
    // A backdated "carryover" style entry, analogous to a user recording pre-existing
    // debt when they start using the book: already POSTED, dated well within the year.
    await createTransaction(pool,userId,{
      bookId,type:"EXPENSE",title:"Carryover",amount:"1000",currencyCode:"TRY",
      accountId:cashId,categoryId:expenseCategoryId,
      transactionDate:"2026-03-10T09:00:00.000Z",clientOperationId:crypto.randomUUID(),
    });
    // A second, later real transaction, so the window between the two `from` dates
    // below still has genuine in-window activity either way.
    await createTransaction(pool,userId,{
      bookId,type:"EXPENSE",title:"Groceries",amount:"200",currencyCode:"TRY",
      accountId:cashId,categoryId:expenseCategoryId,
      transactionDate:"2026-06-05T09:00:00.000Z",clientOperationId:crypto.randomUUID(),
    });
    // A still-pending planned transaction in the future, to prove scheduled impacts
    // keep contributing alongside real ones without being double-counted.
    await createScheduled(pool,userId,{
      bookId,accountId:cashId,transactionType:"EXPENSE",categoryId:expenseCategoryId,
      title:"Planned rent",amount:"300",currencyCode:"TRY",scheduledAt:"2026-11-01T09:00:00.000Z",
    });

    const windowBefore = await loadReportAnalytics(pool,{
      bookId,from:"2026-01-01T00:00:00.000Z",to:"2026-12-31T23:59:59.999Z",
      accountIds:[cashId],includeAllAccounts:false,granularity:"month",
    });
    const windowAfter = await loadReportAnalytics(pool,{
      bookId,from:"2026-04-01T00:00:00.000Z",to:"2026-12-31T23:59:59.999Z",
      accountIds:[cashId],includeAllAccounts:false,granularity:"month",
    });

    // The opening balance is legitimately allowed to differ: it reflects the real
    // balance right before each window's own start date.
    expect(windowBefore.liquidity.openingBalance).toBe("0");
    expect(windowAfter.liquidity.openingBalance).toBe("-1000.000000");

    // But the projected period end (same `to` in both cases, same full set of
    // transactions in scope) must not depend on where `from` was drawn.
    const endBefore = windowBefore.liquidity.items.at(-1)?.projectedBalance;
    const endAfter = windowAfter.liquidity.items.at(-1)?.projectedBalance;
    expect(endBefore).toBe(endAfter);
    expect(Number(endBefore)).toBe(-1500);
  });
});
