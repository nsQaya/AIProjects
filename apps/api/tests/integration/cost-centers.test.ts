import { afterAll,beforeAll,describe,expect,it } from "vitest";
import { readdir,readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import {
  createCostCenter,
  deleteOrDeactivateCostCenter,
  listCostCenters,
  updateCostCenter,
} from "../../src/modules/cost-centers/cost-center.service";
import { loadIncomeExpenseReport } from "../../src/modules/reports/report.routes";
import {
  createScheduled,
  listScheduled,
  realizeScheduled,
} from "../../src/modules/scheduled-transactions/scheduled.service";
import {
  createTransaction,
  reverseTransaction,
} from "../../src/modules/transactions/transaction.service";

const connectionString = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!connectionString);
const migrationsDirectory = fileURLToPath(
  new URL("../../../../packages/database/migrations/",import.meta.url),
);

let schema: string;
let pool: pg.Pool;
let userId: string;
let bookId: string;
let otherBookId: string;
let cashId: string;
let expenseCategoryId: string;

suite("PostgreSQL cost-center integration",()=>{
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
       VALUES('cost-center@example.com','Cost Center','ACTIVE') RETURNING id`,
    );
    userId=user.rows[0]!.id;
    const books = await admin.query<{id:string}>(
      `INSERT INTO books(name,book_type,base_currency,owner_user_id)
       VALUES('Primary','PERSONAL','TRY',$1),('Other','PERSONAL','TRY',$1) RETURNING id`,
      [userId],
    );
    bookId=books.rows[0]!.id;
    otherBookId=books.rows[1]!.id;
    await admin.query(
      `INSERT INTO book_members(book_id,user_id,role,status)
       VALUES($1,$2,'OWNER','ACTIVE'),($3,$2,'OWNER','ACTIVE')`,
      [bookId,userId,otherBookId],
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
       VALUES($1,'Fuel','EXPENSE',$2) RETURNING id`,
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

  it("creates, updates, lists and hard-deletes an unused cost center",async()=>{
    const created = await createCostCenter(pool,userId,{
      bookId,
      name:"Araba",
      description:"Yakıt ve bakım",
      sortOrder:2,
    });
    expect(created).toMatchObject({bookId,name:"Araba",description:"Yakıt ve bakım",isActive:true,version:1});
    const updated = await updateCostCenter(pool,userId,created.id,{
      name:"Aile Arabası",
      description:null,
      sortOrder:1,
      version:created.version,
    });
    expect(updated).toMatchObject({name:"Aile Arabası",description:null,sortOrder:1,version:2});
    expect((await listCostCenters(pool,bookId)).items).toEqual([
      expect.objectContaining({id:created.id,name:"Aile Arabası"}),
    ]);
    expect(await deleteOrDeactivateCostCenter(pool,userId,created.id,updated.version)).toMatchObject({
      id:created.id,
      deleted:true,
      version:3,
    });
    const count = await pool.query<{count:number}>(`SELECT count(*)::int count FROM cost_centers WHERE id=$1`,[created.id]);
    expect(count.rows[0]!.count).toBe(0);
  });

  it("rejects a cost center from another book for transactions and scheduled records",async()=>{
    const foreign = await createCostCenter(pool,userId,{
      bookId:otherBookId,
      name:"Other book",
      sortOrder:0,
    });
    const transaction = {
      bookId,
      type:"EXPENSE" as const,
      title:"Cross-book expense",
      amount:"10",
      currencyCode:"TRY",
      accountId:cashId,
      categoryId:expenseCategoryId,
      costCenterId:foreign.id,
      transactionDate:new Date().toISOString(),
      clientOperationId:crypto.randomUUID(),
    };
    await expect(createTransaction(pool,userId,transaction,"cross-book-cost-center"))
      .rejects.toMatchObject({code:"COST_CENTER_INVALID"});
    await expect(createScheduled(pool,userId,{
      bookId,
      accountId:cashId,
      transactionType:"EXPENSE",
      categoryId:expenseCategoryId,
      costCenterId:foreign.id,
      title:"Cross-book plan",
      amount:"10",
      currencyCode:"TRY",
      scheduledAt:new Date(Date.now()+86_400_000).toISOString(),
    })).rejects.toMatchObject({code:"COST_CENTER_INVALID"});
  });

  it("deactivates a used center, preserves its name and nets reversals in reports",async()=>{
    const center = await createCostCenter(pool,userId,{bookId,name:"Anne",sortOrder:0});
    const posted = await createTransaction(pool,userId,{
      bookId,
      type:"EXPENSE",
      title:"Anne market",
      amount:"125",
      currencyCode:"TRY",
      accountId:cashId,
      categoryId:expenseCategoryId,
      costCenterId:center.id,
      transactionDate:"2026-08-11T12:00:00.000Z",
      clientOperationId:crypto.randomUUID(),
    },"used-cost-center");
    expect(posted.costCenterId).toBe(center.id);
    const report = await loadIncomeExpenseReport(
      pool,bookId,"2026-01-01T00:00:00.000Z","2026-12-31T23:59:59.999Z",
    );
    expect(report.costCenters).toContainEqual(expect.objectContaining({
      id:center.id,
      name:"Anne",
      isActive:true,
      amount:"-125.000000",
    }));
    expect(await deleteOrDeactivateCostCenter(pool,userId,center.id,center.version)).toMatchObject({
      id:center.id,
      isActive:false,
      version:2,
    });
    expect((await listCostCenters(pool,bookId)).items).not.toContainEqual(expect.objectContaining({id:center.id}));
    expect((await listCostCenters(pool,bookId,true)).items).toContainEqual(expect.objectContaining({
      id:center.id,
      name:"Anne",
      isActive:false,
    }));
    await reverseTransaction(pool,userId,bookId,posted.id,crypto.randomUUID(),"test reversal");
    const net = await loadIncomeExpenseReport(
      pool,bookId,"2026-01-01T00:00:00.000Z","2026-12-31T23:59:59.999Z",
    );
    expect(net.costCenters).toContainEqual(expect.objectContaining({
      id:center.id,
      name:"Anne",
      isActive:false,
      amount:"0.000000",
    }));
  });

  it("preserves a deactivated center while realizing its existing scheduled record",async()=>{
    const center = await createCostCenter(pool,userId,{bookId,name:"Baba",sortOrder:3});
    const scheduled = await createScheduled(pool,userId,{
      bookId,
      accountId:cashId,
      transactionType:"EXPENSE",
      categoryId:expenseCategoryId,
      costCenterId:center.id,
      title:"Baba ödeme",
      amount:"75",
      currencyCode:"TRY",
      scheduledAt:new Date(Date.now()+86_400_000).toISOString(),
    });
    expect(scheduled).toMatchObject({costCenterId:center.id,costCenterName:"Baba"});
    await deleteOrDeactivateCostCenter(pool,userId,center.id,center.version);
    const realized = await realizeScheduled(pool,userId,scheduled.id,{
      version:scheduled.version,
      clientOperationId:crypto.randomUUID(),
    });
    expect(realized).toHaveProperty("transaction.costCenterId",center.id);
    const listed = await listScheduled(pool,bookId,true);
    expect(listed.items).toContainEqual(expect.objectContaining({
      id:scheduled.id,
      status:"COMPLETED",
      costCenterId:center.id,
      costCenterName:"Baba",
    }));
  });
});
