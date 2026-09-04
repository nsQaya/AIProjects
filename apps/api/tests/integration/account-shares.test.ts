import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

import { app } from "../../src/app";
import { signAccessToken } from "../../src/common/crypto";
import {
  accountPostingContext,
  listAccountShares,
  listSharedWithMe,
  revokeAccountShare,
  shareAccount,
  updateAccountShare,
} from "../../src/modules/accounts/account-share.service";
import { deleteOrArchiveAccount } from "../../src/modules/accounts/account.service";
import { resolveAccountAccess } from "../../src/middleware/account-access";

const connectionString = process.env.TEST_DATABASE_URL;
const suite = describe.skipIf(!connectionString);
const migrationsDirectory = fileURLToPath(
  new URL("../../../../packages/database/migrations/", import.meta.url),
);

const JWT_SECRET = "account-shares-test-secret-that-is-long-enough";

let schema: string;
let scopedConnectionString: string;
let pool: pg.Pool;
let ownerId: string;
let granteeId: string;
let ownerBookId: string;
let bankAccountId: string;
let systemEquityAccountId: string;

function httpEnv() {
  return {
    HYPERDRIVE: { connectionString: scopedConnectionString },
    JWT_SECRET,
    ALLOWED_ORIGINS: "",
  } as never;
}

async function authHeader(userId: string, email: string) {
  const token = await signAccessToken({ id: userId, email }, JWT_SECRET, 300);
  return `Bearer ${token}`;
}

suite("PostgreSQL account-sharing integration", () => {
  beforeAll(async () => {
    schema = `test_${crypto.randomUUID().replaceAll("-", "")}`;
    const scoped = new URL(connectionString!);
    scoped.searchParams.set("options", `-c search_path=${schema},public`);
    scopedConnectionString = scoped.toString();

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
    const grantee = await admin.query<{ id: string }>(
      `INSERT INTO users(email,display_name,status)
       VALUES('grantee@example.com','Paylaşılan Kişi','ACTIVE') RETURNING id`,
    );
    granteeId = grantee.rows[0]!.id;

    const book = await admin.query<{ id: string }>(
      `INSERT INTO books(name,book_type,base_currency,owner_user_id)
       VALUES('Sahip Defteri','PERSONAL','TRY',$1) RETURNING id`,
      [ownerId],
    );
    ownerBookId = book.rows[0]!.id;
    await admin.query(
      `INSERT INTO book_members(book_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,
      [ownerBookId, ownerId],
    );
    await admin.query(`SELECT seed_default_account_types($1)`, [ownerBookId]);
    await admin.query(`SELECT seed_default_categories($1,'TRY')`, [ownerBookId]);

    const equity = await admin.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Opening Equity',(SELECT id FROM account_types WHERE book_id=$1 AND purpose='SYSTEM_EQUITY'),'CREDIT','TRY',true)
       RETURNING id`,
      [ownerBookId],
    );
    systemEquityAccountId = equity.rows[0]!.id;

    const bank = await admin.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Ortak Banka',(SELECT id FROM account_types WHERE book_id=$1 AND name='Banka'),'DEBIT','TRY',false)
       RETURNING id`,
      [ownerBookId],
    );
    bankAccountId = bank.rows[0]!.id;

    // Fund the account so expenses do not trip the no-overdraft rule.
    const opening = await admin.query<{ id: string }>(
      `INSERT INTO transactions(book_id,transaction_type,account_id,title,transaction_date,status,currency_code,client_operation_id,created_by)
       VALUES($1,'OPENING_BALANCE',$2,'Açılış',now(),'POSTED','TRY',gen_random_uuid(),$3) RETURNING id`,
      [ownerBookId, bankAccountId, ownerId],
    );
    await admin.query(
      `INSERT INTO transaction_entries(transaction_id,account_id,direction,amount,currency_code,base_amount)
       VALUES($1,$2,'DEBIT',5000,'TRY',5000),($1,$3,'CREDIT',5000,'TRY',5000)`,
      [opening.rows[0]!.id, bankAccountId, systemEquityAccountId],
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

  it("rejects sharing a system account or an unknown email", async () => {
    await expect(
      shareAccount(pool, ownerId, systemEquityAccountId, { email: "grantee@example.com", permission: "VIEW" }),
    ).rejects.toMatchObject({ code: "ACCOUNT_NOT_SHAREABLE" });
    await expect(
      shareAccount(pool, ownerId, bankAccountId, { email: "nobody@example.com", permission: "VIEW" }),
    ).rejects.toMatchObject({ code: "GRANTEE_NOT_FOUND" });
    await expect(
      shareAccount(pool, ownerId, bankAccountId, { email: "owner@example.com", permission: "VIEW" }),
    ).rejects.toMatchObject({ code: "CANNOT_SHARE_WITH_SELF" });
  });

  it("shares an account, surfaces it to the grantee, and upgrades permission in place", async () => {
    const share = await shareAccount(pool, ownerId, bankAccountId, {
      email: "grantee@example.com",
      permission: "VIEW",
    });
    expect(share).toMatchObject({ permission: "VIEW", granteeEmail: "grantee@example.com" });

    const mine = await listSharedWithMe(pool, granteeId);
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({
      id: bankAccountId,
      permission: "VIEW",
      ownerBookId,
      ownerName: "Hesap Sahibi",
    });
    // Balance projection comes through.
    expect(mine.items[0].displayBalance).toBe("5000.00");

    // Owner sees nothing shared with themselves.
    expect((await listSharedWithMe(pool, ownerId)).items).toHaveLength(0);

    // Re-sharing updates the existing row rather than inserting a duplicate.
    const upgraded = await shareAccount(pool, ownerId, bankAccountId, {
      email: "grantee@example.com",
      permission: "OPERATE",
    });
    expect(upgraded.id).toBe(share.id);
    expect(upgraded.permission).toBe("OPERATE");
    expect((await listAccountShares(pool, bankAccountId)).items).toHaveLength(1);
  });

  it("resolves the grantee's access level from the share", async () => {
    const access = await resolveAccountAccess(pool, bankAccountId, granteeId);
    expect(access).toMatchObject({ bookId: ownerBookId, level: "OPERATE" });
    const ownerAccess = await resolveAccountAccess(pool, bankAccountId, ownerId);
    expect(ownerAccess.level).toBe("MANAGE");
  });

  it("returns owner-book categories in the posting context for an OPERATE grantee", async () => {
    const context = await accountPostingContext(pool, granteeId, bankAccountId);
    expect(context.bookId).toBe(ownerBookId);
    expect(context.currencyCode).toBe("TRY");
    expect(context.categories.length).toBeGreaterThan(0);
  });

  it("lets an OPERATE grantee post an expense into the owner's book but blocks transfers", async () => {
    const category = await pool.query<{ id: string }>(
      `SELECT id FROM categories WHERE book_id=$1 AND category_type='EXPENSE' AND deleted_at IS NULL LIMIT 1`,
      [ownerBookId],
    );
    const expense = await app.request(
      "/api/v1/transactions",
      {
        method: "POST",
        headers: {
          Authorization: await authHeader(granteeId, "grantee@example.com"),
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          bookId: ownerBookId,
          type: "EXPENSE",
          title: "Market",
          amount: "120.50",
          currencyCode: "TRY",
          accountId: bankAccountId,
          categoryId: category.rows[0]!.id,
          transactionDate: new Date().toISOString(),
          clientOperationId: crypto.randomUUID(),
        }),
      },
      httpEnv(),
    );
    expect(expense.status).toBe(201);
    const posted = (await expense.json()) as { id: string };

    const createdBy = await pool.query<{ created_by: string }>(
      `SELECT created_by FROM transactions WHERE id=$1`,
      [posted.id],
    );
    expect(createdBy.rows[0]!.created_by).toBe(granteeId);

    const transfer = await app.request(
      "/api/v1/transactions",
      {
        method: "POST",
        headers: {
          Authorization: await authHeader(granteeId, "grantee@example.com"),
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          bookId: ownerBookId,
          type: "TRANSFER",
          title: "Kaydırma",
          amount: "10",
          currencyCode: "TRY",
          accountId: bankAccountId,
          targetAccountId: systemEquityAccountId,
          transactionDate: new Date().toISOString(),
          clientOperationId: crypto.randomUUID(),
        }),
      },
      httpEnv(),
    );
    expect(transfer.status).toBe(403);
  });

  it("blocks a VIEW grantee from posting and from reversing others' transactions", async () => {
    await updateAccountShare(pool, ownerId, bankAccountId, await activeShareId(), {
      permission: "VIEW",
      version: await activeShareVersion(),
    });

    const category = await pool.query<{ id: string }>(
      `SELECT id FROM categories WHERE book_id=$1 AND category_type='EXPENSE' AND deleted_at IS NULL LIMIT 1`,
      [ownerBookId],
    );
    const denied = await app.request(
      "/api/v1/transactions",
      {
        method: "POST",
        headers: {
          Authorization: await authHeader(granteeId, "grantee@example.com"),
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          bookId: ownerBookId,
          type: "EXPENSE",
          title: "Yasak",
          amount: "5",
          currencyCode: "TRY",
          accountId: bankAccountId,
          categoryId: category.rows[0]!.id,
          transactionDate: new Date().toISOString(),
          clientOperationId: crypto.randomUUID(),
        }),
      },
      httpEnv(),
    );
    expect(denied.status).toBe(403);
  });

  it("revokes a share and drops the grantee's access", async () => {
    const shareId = await activeShareId();
    const result = await revokeAccountShare(pool, ownerId, bankAccountId, shareId);
    expect(result.status).toBe("REVOKED");
    expect((await listSharedWithMe(pool, granteeId)).items).toHaveLength(0);
    expect((await resolveAccountAccess(pool, bankAccountId, granteeId)).level).toBe("NONE");
  });

  it("revokes remaining shares when the account is hard-deleted", async () => {
    const fresh = await pool.query<{ id: string; version: number }>(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Geçici',(SELECT id FROM account_types WHERE book_id=$1 AND name='Nakit'),'DEBIT','TRY',false)
       RETURNING id,version`,
      [ownerBookId],
    );
    await shareAccount(pool, ownerId, fresh.rows[0]!.id, {
      email: "grantee@example.com",
      permission: "VIEW",
    });
    await deleteOrArchiveAccount(pool, ownerId, fresh.rows[0]!.id, fresh.rows[0]!.version);
    const remaining = await pool.query(
      `SELECT status FROM account_shares WHERE account_id=$1 AND deleted_at IS NULL`,
      [fresh.rows[0]!.id],
    );
    expect(remaining.rowCount).toBe(0);
  });

  async function activeShareId() {
    const row = await pool.query<{ id: string }>(
      `SELECT id FROM account_shares WHERE account_id=$1 AND deleted_at IS NULL`,
      [bankAccountId],
    );
    return row.rows[0]!.id;
  }
  async function activeShareVersion() {
    const row = await pool.query<{ version: number }>(
      `SELECT version FROM account_shares WHERE account_id=$1 AND deleted_at IS NULL`,
      [bankAccountId],
    );
    return row.rows[0]!.version;
  }
});
