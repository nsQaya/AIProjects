import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { readdir,readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadReportAnalytics } from "../../src/modules/reports/report.analytics";
import { loadIncomeExpenseReport } from "../../src/modules/reports/report.routes";
import { createScheduled } from "../../src/modules/scheduled-transactions/scheduled.service";
import { createTransaction,reverseTransaction } from "../../src/modules/transactions/transaction.service";

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
    await admin.query(`SELECT seed_default_account_types($1)`, [bookId]);
    const accounts = await admin.query<{id:string}>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system,allow_negative_balance)
       VALUES($1,'Cash',(SELECT id FROM account_types WHERE book_id=$1 AND name='Nakit'),'DEBIT','TRY',false,true),
             ($1,'Expense',(SELECT id FROM account_types WHERE book_id=$1 AND purpose='SYSTEM_EXPENSE'),'DEBIT','TRY',true,true)
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

    // The events table backs every chart bar: posted transactions dated in the
    // window are listed as realized alongside the still-pending plans, and a
    // transaction dated before the window is not.
    const events = windowAfter.liquidity.events;
    const groceries = events.find((event) => event.title === "Groceries");
    expect(groceries?.realized).toBe(true);
    expect(Number(groceries?.impact)).toBe(-200);
    expect(events).toContainEqual(expect.objectContaining({ title: "Planned rent", realized: false }));
    expect(events.some((event) => event.title === "Carryover")).toBe(false);
  });

  it("rebuilds a foreign-currency opening balance from native amount x latest rate, not stale base_amount",async()=>{
    // A USD account funded when USD was 34 TRY and now sitting on that cash. Each
    // leg recorded its own base_amount TRY snapshot at the rate of its own day,
    // so SUM(base_amount) (34 000) no longer equals the real TRY value. The
    // forecast must value it as native USD * the latest TCMB rate (42) instead.
    const usd = await pool.query<{id:string}>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system,allow_negative_balance)
       VALUES($1,'Piapiri USD',(SELECT id FROM account_types WHERE book_id=$1 AND name='Birikim'),'DEBIT','USD',false,true) RETURNING id`,
      [bookId],
    );
    const usdId = usd.rows[0]!.id;
    const equity = await pool.query<{id:string}>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system,allow_negative_balance)
       VALUES($1,'USD Opening Equity',(SELECT id FROM account_types WHERE book_id=$1 AND purpose='SYSTEM_EQUITY'),'CREDIT','TRY',true,true) RETURNING id`,
      [bookId],
    );
    await pool.query(`INSERT INTO book_currencies(book_id,currency_code) VALUES($1,'USD') ON CONFLICT DO NOTHING`,[bookId]);
    await pool.query(
      `INSERT INTO currency_daily_rates(currency_code,rate_date,try_rate)
       VALUES('USD','2026-02-01',34),('USD',CURRENT_DATE,42) ON CONFLICT DO NOTHING`,
    );
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const funding = await client.query<{id:string}>(
        `INSERT INTO transactions(book_id,transaction_type,account_id,title,transaction_date,status,currency_code,client_operation_id,created_by)
         VALUES($1,'ADJUSTMENT',$2,'USD yatirildi','2026-02-05T09:00:00.000Z','POSTED','USD',gen_random_uuid(),$3) RETURNING id`,
        [bookId,usdId,userId],
      );
      await client.query(
        `INSERT INTO transaction_entries(transaction_id,account_id,direction,amount,currency_code,base_amount)
         VALUES($1,$2,'DEBIT',1000,'USD',34000),($1,$3,'CREDIT',34000,'TRY',34000)`,
        [funding.rows[0]!.id,usdId,equity.rows[0]!.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    const report = await loadReportAnalytics(pool,{
      bookId,from:"2026-06-01T00:00:00.000Z",to:"2026-12-31T23:59:59.999Z",
      accountIds:[usdId],includeAllAccounts:false,granularity:"month",
    });

    // 1000 USD * latest 42 = 42 000 — not the stale 34 000 base_amount snapshot.
    expect(Number(report.liquidity.openingBalance)).toBeCloseTo(42000,2);
    expect(Number(report.liquidity.items.at(-1)?.projectedBalance)).toBeCloseTo(42000,2);
    // The Gelir-Gider-Net balance line rebuilds the same way.
    expect(Number(report.trend.at(-1)?.balance)).toBeCloseTo(42000,2);
  });

  it("does not let a reversed transaction's later-dated reversal show up as phantom movement in either bucket",async()=>{
    // Mirrors what happened in production: a user posts an entry dated in the past,
    // then corrects it (reverses it) much later. The reversal transaction gets its
    // *own* transaction_date (whenever the correction was made), not the original's
    // date - so a naive `status IN ('POSTED','REVERSED')` per-bucket sum shows the
    // original's effect on its own date and the offsetting reversal's effect on a
    // *different* date, as two large non-cancelling phantom swings, even though the
    // net lifetime effect is genuinely zero. A dedicated account keeps this fully
    // isolated from the other test in this file.
    const account = await pool.query<{id:string}>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system,allow_negative_balance)
       VALUES($1,'Correction Cash',(SELECT id FROM account_types WHERE book_id=$1 AND name='Nakit'),'DEBIT','TRY',false,true) RETURNING id`,
      [bookId],
    );
    const correctionCashId = account.rows[0]!.id;

    const now = new Date();
    const originalDate = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-6,15,9,0,0));
    const created = await createTransaction(pool,userId,{
      bookId,type:"EXPENSE",title:"Mis-dated entry",amount:"777",currencyCode:"TRY",
      accountId:correctionCashId,categoryId:expenseCategoryId,
      transactionDate:originalDate.toISOString(),clientOperationId:crypto.randomUUID(),
    });
    // The reversal's own transaction_date is set by reverseTransaction to "now",
    // which is deliberately several months away from originalDate above.
    await reverseTransaction(pool,userId,bookId,created.id,crypto.randomUUID(),"dated correction");

    const from = new Date(Date.UTC(originalDate.getUTCFullYear(),originalDate.getUTCMonth()-1,1)).toISOString();
    const to = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+2,0,23,59,59,999)).toISOString();
    const report = await loadReportAnalytics(pool,{
      bookId,from,to,accountIds:[correctionCashId],includeAllAccounts:false,granularity:"month",
    });

    const label = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,"0")}`;
    const originalBucket = report.liquidity.items.find((item) => item.period===label(originalDate));
    const reversalBucket = report.liquidity.items.find((item) => item.period===label(now));

    expect(originalBucket?.net).toBe("0");
    expect(reversalBucket?.net).toBe("0");
    expect(report.liquidity.openingBalance).toBe("0");
    expect(report.liquidity.items.at(-1)?.projectedBalance).toBe("0");

    // The trend tab (Gelir · Gider · Net) sums the same real-transaction data
    // per bucket and had the identical latent bug.
    const trendOriginal = report.trend.find((item) => item.period===label(originalDate));
    const trendReversal = report.trend.find((item) => item.period===label(now));
    expect(trendOriginal?.net).toBe("0");
    expect(trendReversal?.net).toBe("0");

    // report.routes.ts's income/expense breakdown (dashboard "Aylık net" and the
    // category/cost-center report) shares the same query shape - check it directly
    // for the month the mis-dated entry originally landed in.
    const monthStart = new Date(Date.UTC(originalDate.getUTCFullYear(),originalDate.getUTCMonth(),1)).toISOString();
    const monthEnd = new Date(Date.UTC(originalDate.getUTCFullYear(),originalDate.getUTCMonth()+1,0,23,59,59,999)).toISOString();
    const monthly = await loadIncomeExpenseReport(pool,bookId,monthStart,monthEnd,[correctionCashId],false);
    // The category only ever had the now-excluded reversed entry in this month, so
    // it must not appear at all (not appear with a phantom non-zero amount).
    expect(monthly.items.some((item) => item.name==="Market")).toBe(false);
  });

  it("builds the instrument comparison series and the per-account total-value series",async()=>{
    // Exercises the three instrumentComparison queries against real Postgres - the
    // dominant-account pick, the per-bucket unit price and the per-account holding
    // value all share the same params array as every other analytics query (see
    // report.analytics param gotcha).
    await pool.query(`SELECT seed_default_investment_types($1)`,[bookId]);
    const brokerage = await pool.query<{id:string}>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Piapiri',(SELECT id FROM account_types WHERE book_id=$1 AND name='Birikim'),'DEBIT','TRY',false) RETURNING id`,
      [bookId],
    );
    const brokerageId = brokerage.rows[0]!.id;
    const instrument = await pool.query<{id:string}>(
      `INSERT INTO investment_instruments(book_id,asset_type_id,name,symbol,currency_code)
       VALUES($1,(SELECT id FROM investment_asset_types WHERE book_id=$1 AND name='Yatırım Fonu'),'Karşılaştırma Fonu','KRF','TRY') RETURNING id`,
      [bookId],
    );
    const instrumentId = instrument.rows[0]!.id;
    await pool.query(
      `INSERT INTO investment_lots(book_id,instrument_id,account_id,quantity,unit_price,purchased_at)
       VALUES($1,$2,$3,10,5,'2026-05-01T09:00:00.000Z')`,
      [bookId,instrumentId,brokerageId],
    );
    await pool.query(
      `INSERT INTO investment_prices(instrument_id,price,priced_at) VALUES
       ($1,5,'2026-05-15T00:00:00.000Z'),($1,8,'2026-08-15T00:00:00.000Z')`,
      [instrumentId],
    );

    const report = await loadReportAnalytics(pool,{
      bookId,from:"2026-05-01T00:00:00.000Z",to:"2026-09-30T23:59:59.999Z",
      accountIds:[brokerageId],includeAllAccounts:false,granularity:"month",
    });

    const meta = report.instrumentComparison.instruments.find((row) => row.instrumentId===instrumentId);
    expect(meta?.symbol).toBe("KRF");
    expect(meta?.accountId).toBe(brokerageId);
    expect(meta?.accountName).toBe("Piapiri");
    expect(report.instrumentComparison.accounts).toEqual([{ accountId: brokerageId, name: "Piapiri" }]);

    const priceSeries = report.instrumentComparison.instrumentPoints.filter((point) => point.instrumentId===instrumentId);
    expect(priceSeries.length).toBeGreaterThan(0);
    // Latest price at or before the last bucket start (2026-09-01) is 8.
    expect(Number(priceSeries.at(-1)?.price)).toBeCloseTo(8,2);

    const valueSeries = report.instrumentComparison.accountPoints.filter((point) => point.accountId===brokerageId);
    expect(valueSeries.length).toBeGreaterThan(0);
    // 10 units * latest price 8 = 80 by the last bucket.
    expect(Number(valueSeries.at(-1)?.value)).toBeCloseTo(80,2);
  });
});
