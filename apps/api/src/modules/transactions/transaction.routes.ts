import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { parseJson } from "../../common/validation";
import { getBookRole, hasBookRole } from "../../middleware/book-access";
import { assertAccountAccess, hasAccountLevel, resolveAccountAccess } from "../../middleware/account-access";
import { AppError } from "../../common/errors";
import type { DbClient } from "../../infrastructure/database";
import { correctionSchema, reversalSchema, transactionMutationSchema } from "./transaction.schemas";
import { correctTransaction, createTransaction, reverseTransaction } from "./transaction.service";

export const transactionRoutes = new Hono<AppEnv>();

transactionRoutes.get("/",async (c) => {
  const pool = c.get("database");
  const userId = c.get("user").id;
  const bookId = c.req.query("bookId") ?? "";
  const parsedLimit = Number(c.req.query("limit") ?? 100);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit,1),1000) : 100;
  const cursor = c.req.query("cursor") ?? null;
  const rawAccountIds=c.req.query("accountIds");
  const legacyAccountId=c.req.query("accountId");
  let includeAllAccounts=rawAccountIds===undefined&&!legacyAccountId;
  const accountIds=includeAllAccounts||rawAccountIds==="none"?[]:(rawAccountIds?.split(",").filter(Boolean)??[legacyAccountId!]);
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(accountIds.length>200||accountIds.some(id=>!uuid.test(id)))throw new AppError(422,"INVALID_ACCOUNT_FILTER","Account filter contains an invalid identifier");
  // Book members read normally. A grantee with no book role may still read a
  // specific shared account's ledger: the filter must name accounts, and every
  // one must be VIEW+ shared with them in this book.
  if(!(await getBookRole(pool,bookId,userId))){
    if(!accountIds.length)throw new AppError(403,"BOOK_ACCESS_DENIED","You do not have access to this book");
    for(const id of accountIds){
      const access=await resolveAccountAccess(pool,id,userId);
      if(access.bookId!==bookId||!hasAccountLevel(access,"VIEW"))throw new AppError(403,"ACCOUNT_ACCESS_DENIED","You do not have access to this account");
    }
    includeAllAccounts=false;
  }
  const categoryId = c.req.query("categoryId") ?? null;
  const costCenterId = c.req.query("costCenterId") ?? null;
  if(costCenterId&&!uuid.test(costCenterId))throw new AppError(422,"INVALID_COST_CENTER_FILTER","Cost center filter contains an invalid identifier");
  const from = c.req.query("from") ?? null;
  const to = c.req.query("to") ?? null;
  const [result,opening]=await Promise.all([
    pool.query(
    `WITH ledger AS (
       SELECT t.id,
         SUM(CASE WHEN e.direction='DEBIT' THEN e.amount ELSE -e.amount END) AS delta,
         SUM(SUM(CASE WHEN e.direction='DEBIT' THEN e.amount ELSE -e.amount END))
           OVER(ORDER BY t.transaction_date,t.transaction_no) AS running_balance
       FROM transactions t
       JOIN transaction_entries e ON e.transaction_id=t.id
       JOIN accounts ledger_account ON ledger_account.id=e.account_id
       WHERE t.book_id=$1 AND t.deleted_at IS NULL AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
         AND ledger_account.is_system=false AND ledger_account.deleted_at IS NULL
         AND ($5::boolean OR e.account_id=ANY($4::uuid[]))
       GROUP BY t.id
     )
     SELECT t.id,t.transaction_no::text AS "transactionNo",t.transaction_type AS type,
            t.account_id AS "accountId",source.name AS "accountName",
            t.target_account_id AS "targetAccountId",target.name AS "targetAccountName",
            t.title,t.description,t.transaction_date AS "transactionDate",t.due_date AS "dueDate",
            t.status,t.currency_code AS "currencyCode",t.category_id AS "categoryId",
            category.name AS "categoryName",t.cost_center_id AS "costCenterId",
            cost_center.name AS "costCenterName",t.contact_id AS "contactId",t.version,
            ledger.delta::text AS "balanceDelta",ledger.running_balance::text AS "runningBalance",
            COALESCE((SELECT e.amount::text FROM transaction_entries e
              WHERE e.transaction_id=t.id AND e.account_id=t.account_id LIMIT 1),
              (SELECT e.amount::text FROM transaction_entries e WHERE e.transaction_id=t.id LIMIT 1)) AS amount
     FROM transactions t
     JOIN ledger ON ledger.id=t.id
     LEFT JOIN accounts source ON source.id=t.account_id
     LEFT JOIN accounts target ON target.id=t.target_account_id
     LEFT JOIN categories category ON category.id=t.category_id
     LEFT JOIN cost_centers cost_center ON cost_center.id=t.cost_center_id
     WHERE t.book_id=$1 AND t.deleted_at IS NULL AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
       AND ($3::timestamptz IS NULL OR (t.transaction_date,t.transaction_no)<($3::timestamptz,9223372036854775807))
       AND ($6::uuid IS NULL OR t.category_id=$6)
       AND ($7::timestamptz IS NULL OR t.transaction_date>=$7)
       AND ($8::timestamptz IS NULL OR t.transaction_date<=$8)
       AND ($9::uuid IS NULL OR t.cost_center_id=$9)
     ORDER BY t.transaction_date DESC,t.transaction_no DESC LIMIT $2`,
    [bookId,limit,cursor,accountIds,includeAllAccounts,categoryId,from,to,costCenterId],
    ),
    pool.query(
      `SELECT COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.amount ELSE -e.amount END),0)::text AS balance
       FROM transaction_entries e
       JOIN accounts a ON a.id=e.account_id
       JOIN transactions t ON t.id=e.transaction_id
       WHERE t.book_id=$1 AND t.deleted_at IS NULL AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
         AND a.is_system=false AND a.deleted_at IS NULL
         AND ($3::boolean OR e.account_id=ANY($2::uuid[]))
         AND $4::timestamptz IS NOT NULL AND t.transaction_date<$4::timestamptz`,
      [bookId,accountIds,includeAllAccounts,from],
    ),
  ]);
  return c.json({items:result.rows,openingBalance:opening.rows[0]?.balance??"0",nextCursor:result.rows.length===limit?result.rows.at(-1).transactionDate:null});
});

transactionRoutes.post("/",async (c) => {
  const input = await parseJson(c.req.raw,transactionMutationSchema);
  const pool = c.get("database");
  const userId = c.get("user").id;
  if (!hasBookRole(await getBookRole(pool,input.bookId,userId),"EDITOR")) {
    // OPERATE-share fallback: a plain income/expense posting against one shared account.
    if ((input.type !== "INCOME" && input.type !== "EXPENSE") || input.targetAccountId) {
      throw new AppError(403,"INSUFFICIENT_ROLE","This action requires EDITOR access");
    }
    const access = await assertAccountAccess(pool,input.accountId,userId,"OPERATE");
    if (access.bookId !== input.bookId) throw new AppError(422,"BOOK_MISMATCH","Account belongs to another book");
  }
  const key = c.req.header("Idempotency-Key");
  if (!key) throw new AppError(422,"IDEMPOTENCY_KEY_REQUIRED","Idempotency-Key header is required");
  return c.json(await createTransaction(pool,userId,input,key),201);
});

transactionRoutes.post("/:transactionId/reverse",async (c) => {
  const input = await parseJson(c.req.raw,reversalSchema);
  const pool = c.get("database");
  const userId = c.get("user").id;
  const bookId = c.req.query("bookId") ?? "";
  await assertReversalAccess(pool,bookId,userId,c.req.param("transactionId"));
  if (!c.req.header("Idempotency-Key")) throw new AppError(422,"IDEMPOTENCY_KEY_REQUIRED","Idempotency-Key header is required");
  return c.json(await reverseTransaction(pool,userId,bookId,c.req.param("transactionId"),input.clientOperationId,input.reason),201);
});

transactionRoutes.post("/:transactionId/correct",async (c) => {
  const input = await parseJson(c.req.raw,correctionSchema);
  const pool = c.get("database");
  const userId = c.get("user").id;
  const bookId = c.req.query("bookId") ?? "";
  if (!hasBookRole(await getBookRole(pool,bookId,userId),"EDITOR")
      && ((input.replacement.type !== "INCOME" && input.replacement.type !== "EXPENSE") || input.replacement.targetAccountId)) {
    throw new AppError(403,"INSUFFICIENT_ROLE","This action requires EDITOR access");
  }
  await assertReversalAccess(pool,bookId,userId,c.req.param("transactionId"),input.replacement.accountId);
  if (!c.req.header("Idempotency-Key")) throw new AppError(422,"IDEMPOTENCY_KEY_REQUIRED","Idempotency-Key header is required");
  return c.json(await correctTransaction(pool,userId,bookId,c.req.param("transactionId"),input.reversalClientOperationId,input.reason,input.replacement),201);
});

/**
 * Book EDITOR+ may reverse/correct anything. A grantee may only touch a transaction
 * they created themselves, and only when every account it (or its replacement) posts
 * to is OPERATE-shared with them.
 */
async function assertReversalAccess(
  pool: DbClient,
  bookId: string,
  userId: string,
  transactionId: string,
  replacementAccountId?: string,
) {
  if (hasBookRole(await getBookRole(pool,bookId,userId),"EDITOR")) return;
  const original = await pool.query<{ created_by: string; account_id: string; target_account_id: string | null }>(
    `SELECT created_by,account_id,target_account_id FROM transactions
     WHERE id=$1 AND book_id=$2 AND deleted_at IS NULL`,
    [transactionId,bookId],
  );
  const row = original.rows[0];
  if (!row) throw new AppError(404,"TRANSACTION_NOT_FOUND","Transaction was not found");
  if (row.created_by !== userId) throw new AppError(403,"INSUFFICIENT_ROLE","This action requires EDITOR access");
  const ids = new Set([row.account_id, row.target_account_id, replacementAccountId].filter(Boolean) as string[]);
  for (const id of ids) await assertAccountAccess(pool,id,userId,"OPERATE");
}
