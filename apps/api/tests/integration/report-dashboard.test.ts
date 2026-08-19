import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { readdir,readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { loadDashboardRecentTransactions } from "../../src/modules/reports/report.routes";
import { createTransaction } from "../../src/modules/transactions/transaction.service";

// Regression coverage for a bug where the dashboard's "Son işlemler" panel could
// show almost nothing even for an active book: the query backing it had no lower
// bound excluding future-dated transactions (e.g. an insurance instalment already
// realized months ahead), so those sorted first under ORDER BY transaction_date
// DESC and crowded the small LIMIT window, starving out genuinely recent past
// activity - which is what the panel's own range switch (1 ay/3 ay/...) is
// supposed to be filtering. See loadDashboardRecentTransactions in report.routes.ts.

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

suite("PostgreSQL dashboard recent-transactions integration",()=>{
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
       VALUES('dashboard@example.com','Dashboard','ACTIVE') RETURNING id`,
    );
    userId=user.rows[0]!.id;
    const book = await admin.query<{id:string}>(
      `INSERT INTO books(name,book_type,base_currency,owner_user_id)
       VALUES('Dashboard Book','PERSONAL','TRY',$1) RETURNING id`,
      [userId],
    );
    bookId=book.rows[0]!.id;
    await admin.query(
      `INSERT INTO book_members(book_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
      [bookId,userId],
    );
    const accounts = await admin.query<{id:string}>(
      `INSERT INTO accounts(book_id,name,account_type,normal_balance,currency_code,is_system,allow_negative_balance)
       VALUES($1,'Cash','CASH','DEBIT','TRY',false,true),
             ($1,'Expense','SYSTEM_EXPENSE','DEBIT','TRY',true,true)
       RETURNING id`,
      [bookId],
    );
    cashId=accounts.rows[0]!.id;
    const category = await admin.query<{id:string}>(
      `INSERT INTO categories(book_id,name,category_type,system_account_id)
       VALUES($1,'Sigorta','EXPENSE',$2) RETURNING id`,
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

  it("excludes future-dated transactions so they cannot crowd out genuinely recent ones",async()=>{
    const now = new Date();
    const daysAgo = (days: number) => new Date(now.getTime()-days*24*60*60*1000).toISOString();
    const monthsAhead = (months: number) => {
      const date = new Date(now);
      date.setUTCMonth(date.getUTCMonth()+months);
      return date.toISOString();
    };

    // Eight future-realized instalments - analogous to production's recurring
    // "Kasko" payments already posted for the next several months - which must
    // never outrank real recent past activity in a DESC-by-date, LIMIT'd query.
    for (let month=1;month<=8;month++) {
      await createTransaction(pool,userId,{
        bookId,type:"EXPENSE",title:`Future instalment ${month}`,amount:"100",currencyCode:"TRY",
        accountId:cashId,categoryId:expenseCategoryId,
        transactionDate:monthsAhead(month),clientOperationId:crypto.randomUUID(),
      });
    }
    // Three genuinely recent past transactions, well within any "1 ay" window.
    const recentTitles = ["Market","Yakıt","Maaş"];
    for (const [index,title] of recentTitles.entries()) {
      await createTransaction(pool,userId,{
        bookId,type:"EXPENSE",title,amount:"50",currencyCode:"TRY",
        accountId:cashId,categoryId:expenseCategoryId,
        transactionDate:daysAgo(index+1),clientOperationId:crypto.randomUUID(),
      });
    }

    const rows = await loadDashboardRecentTransactions(pool,bookId);

    expect(rows.some((row: {title:string}) => row.title.startsWith("Future instalment"))).toBe(false);
    for (const title of recentTitles) {
      expect(rows.some((row: {title:string}) => row.title===title)).toBe(true);
    }
    // Newest first: "Market" is daysAgo(1), the most recent of the three.
    expect(rows[0]!.title).toBe("Market");
  },30000);
});
