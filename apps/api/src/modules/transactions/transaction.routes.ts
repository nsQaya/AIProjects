import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { parseJson } from "../../common/validation";
import { requireBookRole } from "../../middleware/book-access";
import { AppError } from "../../common/errors";
import { correctionSchema, reversalSchema, transactionMutationSchema } from "./transaction.schemas";
import { correctTransaction, createTransaction, reverseTransaction } from "./transaction.service";

export const transactionRoutes = new Hono<AppEnv>();

transactionRoutes.get("/",async (c) => {
  const pool = c.get("database");
  const bookId = c.req.query("bookId") ?? "";
  await requireBookRole(pool,bookId,c.get("user").id,"VIEWER");
  const parsedLimit = Number(c.req.query("limit") ?? 100);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit,1),1000) : 100;
  const cursor = c.req.query("cursor") ?? null;
  const rawAccountIds=c.req.query("accountIds");
  const legacyAccountId=c.req.query("accountId");
  const includeAllAccounts=rawAccountIds===undefined&&!legacyAccountId;
  const accountIds=includeAllAccounts||rawAccountIds==="none"?[]:(rawAccountIds?.split(",").filter(Boolean)??[legacyAccountId!]);
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if(accountIds.length>200||accountIds.some(id=>!uuid.test(id)))throw new AppError(422,"INVALID_ACCOUNT_FILTER","Account filter contains an invalid identifier");
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
  await requireBookRole(pool,input.bookId,c.get("user").id,"EDITOR");
  const key = c.req.header("Idempotency-Key");
  if (!key) throw new AppError(422,"IDEMPOTENCY_KEY_REQUIRED","Idempotency-Key header is required");
  return c.json(await createTransaction(pool,c.get("user").id,input,key),201);
});

transactionRoutes.post("/:transactionId/reverse",async (c) => {
  const input = await parseJson(c.req.raw,reversalSchema);
  const pool = c.get("database");
  const bookId = c.req.query("bookId") ?? "";
  await requireBookRole(pool,bookId,c.get("user").id,"EDITOR");
  if (!c.req.header("Idempotency-Key")) throw new AppError(422,"IDEMPOTENCY_KEY_REQUIRED","Idempotency-Key header is required");
  return c.json(await reverseTransaction(pool,c.get("user").id,bookId,c.req.param("transactionId"),input.clientOperationId,input.reason),201);
});

transactionRoutes.post("/:transactionId/correct",async (c) => {
  const input = await parseJson(c.req.raw,correctionSchema);
  const pool = c.get("database");
  const bookId = c.req.query("bookId") ?? "";
  await requireBookRole(pool,bookId,c.get("user").id,"EDITOR");
  if (!c.req.header("Idempotency-Key")) throw new AppError(422,"IDEMPOTENCY_KEY_REQUIRED","Idempotency-Key header is required");
  return c.json(await correctTransaction(pool,c.get("user").id,bookId,c.req.param("transactionId"),input.reversalClientOperationId,input.reason,input.replacement),201);
});
