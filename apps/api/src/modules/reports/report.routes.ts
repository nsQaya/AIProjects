import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { AppError } from "../../common/errors";
import type { DbClient } from "../../infrastructure/database";
import { requireBookRole } from "../../middleware/book-access";
import { loadReportAnalytics } from "./report.analytics";

export const reportRoutes = new Hono<AppEnv>();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function accountScope(rawAccountIds: string | undefined) {
  const includeAllAccounts = rawAccountIds === undefined || rawAccountIds === "all";
  const accountIds = includeAllAccounts || rawAccountIds === "none"
    ? []
    : rawAccountIds.split(",").filter(Boolean);
  if (accountIds.length > 200 || accountIds.some((id) => !uuidPattern.test(id))) {
    throw new AppError(422,"INVALID_ACCOUNT_FILTER","Account filter contains an invalid identifier");
  }
  return { accountIds, includeAllAccounts };
}

async function context(c: any) {
  const pool = c.get("database");
  const bookId = c.req.query("bookId") ?? "";
  await requireBookRole(pool,bookId,c.get("user").id,"VIEWER");
  const now = new Date();
  return {
    pool,bookId,
    from:c.req.query("from") ?? new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString(),
    to:c.req.query("to") ?? now.toISOString(),
    ...accountScope(c.req.query("accountIds")),
  };
}

// Feeds the dashboard's "Son işlemler" panel, which applies its own client-side
// range switch (1 ay/3 ay/.../10 yıl) by filtering this one fixed batch rather
// than re-querying per range. It must exclude future-dated transactions (e.g.
// already-realized recurring items dated months ahead) - otherwise those
// dominate the DESC/LIMIT window and starve out genuinely recent past
// activity, which is what "recent" means here. LIMIT is generous (not just
// enough for the 5-row preview) so wider ranges still have real data to filter
// down to.
export async function loadDashboardRecentTransactions(pool: DbClient, bookId: string) {
  const result = await pool.query(
    `SELECT t.id,t.transaction_type AS type,t.title,t.transaction_date AS "transactionDate",
            t.currency_code AS "currencyCode",e.amount::text AS amount
     FROM transactions t
     LEFT JOIN LATERAL (SELECT amount FROM transaction_entries WHERE transaction_id=t.id LIMIT 1) e ON true
     WHERE t.book_id=$1 AND t.deleted_at IS NULL AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
       AND t.transaction_date<=now()
     ORDER BY t.transaction_date DESC,t.transaction_no DESC LIMIT 100`,
    [bookId],
  );
  return result.rows;
}

const incomeExpenseSql = `
  SELECT
    COALESCE(SUM(CASE WHEN at.purpose='SYSTEM_INCOME' AND e.direction='CREDIT' THEN e.base_amount
                      WHEN at.purpose='SYSTEM_INCOME' THEN -e.base_amount ELSE 0 END),0)::text AS income,
    COALESCE(SUM(CASE WHEN at.purpose='SYSTEM_EXPENSE' AND e.direction='DEBIT' THEN e.base_amount
                      WHEN at.purpose='SYSTEM_EXPENSE' THEN -e.base_amount ELSE 0 END),0)::text AS expense
  FROM transaction_entries e
  JOIN accounts a ON a.id=e.account_id
  JOIN account_types at ON at.id=a.account_type_id
  JOIN transactions t ON t.id=e.transaction_id
  WHERE t.book_id=$1 AND t.status='POSTED' AND t.transaction_type<>'REVERSAL' AND t.transaction_date BETWEEN $2 AND $3`;

export async function loadIncomeExpenseReport(
  pool: DbClient,
  bookId: string,
  from: string,
  to: string,
  accountIds: readonly string[] = [],
  includeAllAccounts = true,
) {
  const [result,costCenters] = await Promise.all([pool.query(
    `SELECT c.id,c.name,c.category_type AS type,c.is_active AS "isActive",
            COALESCE(SUM(CASE WHEN c.category_type='INCOME' AND e.direction='CREDIT' THEN e.base_amount
                              WHEN c.category_type='EXPENSE' AND e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0)::text amount
     FROM categories c JOIN transaction_entries e ON e.account_id=c.system_account_id
     JOIN transactions t ON t.id=e.transaction_id
     WHERE c.book_id=$1 AND t.status='POSTED' AND t.transaction_type<>'REVERSAL' AND t.transaction_date BETWEEN $2 AND $3
       AND ($5::boolean OR EXISTS (
         SELECT 1 FROM transaction_entries scoped_e
         JOIN accounts scoped_a ON scoped_a.id=scoped_e.account_id
         WHERE scoped_e.transaction_id=t.id AND scoped_a.is_system=false
           AND scoped_e.account_id=ANY($4::uuid[])
       ))
     GROUP BY c.id ORDER BY c.category_type,c.name`,
    [bookId,from,to,accountIds,includeAllAccounts],
  ),pool.query(
    `SELECT cc.id,cc.name,cc.is_active AS "isActive",
            COALESCE(SUM(CASE
              WHEN at.purpose='SYSTEM_INCOME' AND e.direction='CREDIT' THEN e.base_amount
              WHEN at.purpose='SYSTEM_INCOME' THEN -e.base_amount
              WHEN at.purpose='SYSTEM_EXPENSE' AND e.direction='DEBIT' THEN -e.base_amount
              WHEN at.purpose='SYSTEM_EXPENSE' THEN e.base_amount
              ELSE 0 END),0)::text amount
     FROM cost_centers cc
     JOIN transactions t ON t.cost_center_id=cc.id
     JOIN transaction_entries e ON e.transaction_id=t.id
     JOIN accounts a ON a.id=e.account_id
     JOIN account_types at ON at.id=a.account_type_id
     WHERE cc.book_id=$1 AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
       AND t.transaction_date BETWEEN $2 AND $3
       AND at.purpose IN ('SYSTEM_INCOME','SYSTEM_EXPENSE')
       AND ($5::boolean OR EXISTS (
         SELECT 1 FROM transaction_entries scoped_e
         JOIN accounts scoped_a ON scoped_a.id=scoped_e.account_id
         WHERE scoped_e.transaction_id=t.id AND scoped_a.is_system=false
           AND scoped_e.account_id=ANY($4::uuid[])
       ))
     GROUP BY cc.id ORDER BY cc.sort_order,cc.name`,
    [bookId,from,to,accountIds,includeAllAccounts],
  )]);
  return {items:result.rows,costCenters:costCenters.rows};
}

reportRoutes.get("/dashboard",async (c) => {
  const {pool,bookId,from,to} = await context(c);
  const [summary,accounts,recent,upcoming] = await Promise.all([
    pool.query(incomeExpenseSql,[bookId,from,to]),
    pool.query(
      `SELECT a.id,a.name,a.account_type_id AS "accountTypeId",at.name AS "accountTypeName",a.currency_code AS "currencyCode",
              a.credit_limit::text AS "creditLimit",
              (CASE WHEN a.normal_balance='DEBIT'
                THEN COALESCE(SUM(CASE WHEN t.id IS NULL THEN 0 WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0)
                ELSE -COALESCE(SUM(CASE WHEN t.id IS NULL THEN 0 WHEN e.direction='CREDIT' THEN e.base_amount ELSE -e.base_amount END),0)
              END)::text AS balance
       FROM accounts a
       JOIN account_types at ON at.id=a.account_type_id
       LEFT JOIN transaction_entries e ON e.account_id=a.id
       LEFT JOIN transactions t ON t.id=e.transaction_id AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
       WHERE a.book_id=$1 AND a.is_system=false AND a.deleted_at IS NULL AND a.is_archived=false
       GROUP BY a.id,at.name ORDER BY a.sort_order,a.name LIMIT 8`,
      [bookId],
    ),
    loadDashboardRecentTransactions(pool,bookId),
    pool.query(
      `SELECT id,title,amount::text,currency_code AS "currencyCode",scheduled_at AS "scheduledAt",transaction_type AS type
       FROM scheduled_transactions
       WHERE book_id=$1 AND status IN ('PENDING','OVERDUE') AND deleted_at IS NULL
       ORDER BY scheduled_at LIMIT 10`,
      [bookId],
    ),
  ]);
  return c.json({month:summary.rows[0],importantAccounts:accounts.rows,recentTransactions:recent,upcoming:upcoming.rows});
});

reportRoutes.get("/cash-flow",async (c) => {
  const {pool,bookId,from,to,accountIds,includeAllAccounts} = await context(c);
  const requested=c.req.query("granularity")??"month";
  const granularity=["day","week","month","year"].includes(requested)?requested:"month";
  const intervals:Record<string,string>={day:"1 day",week:"1 week",month:"1 month",year:"1 year"};
  const formats:Record<string,string>={day:"YYYY-MM-DD",week:"YYYY-MM-DD",month:"YYYY-MM",year:"YYYY"};
  const interval=intervals[granularity]!;
  const format=formats[granularity]!;
  const result = await pool.query(
    `WITH periods AS (
       SELECT generate_series(date_trunc($4,$2::timestamptz),date_trunc($4,$3::timestamptz),$5::interval) AS bucket
     ), totals AS (
       SELECT date_trunc($4,t.transaction_date) AS bucket,
         SUM(CASE WHEN at.purpose='SYSTEM_INCOME' AND e.direction='CREDIT' THEN e.base_amount
                  WHEN at.purpose='SYSTEM_INCOME' THEN -e.base_amount ELSE 0 END) income,
         SUM(CASE WHEN at.purpose='SYSTEM_EXPENSE' AND e.direction='DEBIT' THEN e.base_amount
                  WHEN at.purpose='SYSTEM_EXPENSE' THEN -e.base_amount ELSE 0 END) expense
       FROM transaction_entries e
       JOIN accounts a ON a.id=e.account_id
       JOIN account_types at ON at.id=a.account_type_id
       JOIN transactions t ON t.id=e.transaction_id
       WHERE t.book_id=$1 AND t.status='POSTED' AND t.transaction_type<>'REVERSAL' AND t.transaction_date BETWEEN $2 AND $3
       GROUP BY 1
     )
     SELECT to_char(p.bucket,$6) AS period,to_char(p.bucket,'YYYY-MM') AS month,
            p.bucket AS "periodStart",COALESCE(t.income,0)::text income,
            COALESCE(t.expense,0)::text expense,(COALESCE(t.income,0)-COALESCE(t.expense,0))::text net,
            COALESCE(b.balance,0)::text balance
     FROM periods p
     LEFT JOIN totals t ON t.bucket=p.bucket
     LEFT JOIN LATERAL (
       SELECT COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0) AS balance
       FROM transaction_entries e
       JOIN transactions bt ON bt.id=e.transaction_id AND bt.status='POSTED' AND bt.transaction_type<>'REVERSAL'
       JOIN accounts ba ON ba.id=e.account_id
       WHERE bt.book_id=$1 AND ba.is_system=false AND ba.deleted_at IS NULL
         AND bt.transaction_date < p.bucket+$5::interval AND bt.transaction_date <= $3::timestamptz
         AND ($8::boolean OR ba.id=ANY($7::uuid[]))
     ) b ON true
     ORDER BY p.bucket`,
    [bookId,from,to,granularity,interval,format,accountIds,includeAllAccounts],
  );
  return c.json({items:result.rows,granularity,from,to});
});

reportRoutes.get("/analytics",async (c) => {
  const {pool,bookId,from,to,accountIds,includeAllAccounts} = await context(c);
  const requested=c.req.query("granularity")??"month";
  const granularity=(['day','week','month','year'] as const).find((value)=>value===requested)??"month";
  const fromDate=new Date(from),toDate=new Date(to);
  if(!Number.isFinite(fromDate.getTime())||!Number.isFinite(toDate.getTime())||fromDate>toDate){
    throw new AppError(422,"INVALID_REPORT_RANGE","Report date range is invalid");
  }
  const rangeDays=(toDate.getTime()-fromDate.getTime())/86_400_000;
  const maximumDays={day:370,week:3_700,month:11_000,year:36_600}[granularity];
  if(rangeDays>maximumDays){
    throw new AppError(422,"REPORT_RESOLUTION_TOO_DETAILED","Select a coarser grouping for this report date range");
  }
  return c.json(await loadReportAnalytics(pool,{
    accountIds,bookId,from,granularity,includeAllAccounts,to,
  }));
});

reportRoutes.get("/income-expense",async (c) => {
  const {pool,bookId,from,to,accountIds,includeAllAccounts} = await context(c);
  return c.json(await loadIncomeExpenseReport(pool,bookId,from,to,accountIds,includeAllAccounts));
});

reportRoutes.get("/balances",async (c) => {
  const {pool,bookId} = await context(c);
  const result = await pool.query(
    `SELECT a.id,a.name,a.account_type_id AS "accountTypeId",at.name AS "accountTypeName",a.currency_code AS "currencyCode",
            (CASE WHEN a.normal_balance='DEBIT'
              THEN COALESCE(SUM(CASE WHEN t.id IS NULL THEN 0 WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0)
              ELSE -COALESCE(SUM(CASE WHEN t.id IS NULL THEN 0 WHEN e.direction='CREDIT' THEN e.base_amount ELSE -e.base_amount END),0)
            END)::text balance
     FROM accounts a
     JOIN account_types at ON at.id=a.account_type_id
     LEFT JOIN transaction_entries e ON e.account_id=a.id
     LEFT JOIN transactions t ON t.id=e.transaction_id AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
     WHERE a.book_id=$1 AND a.is_system=false AND a.deleted_at IS NULL
     GROUP BY a.id,at.name ORDER BY a.name`,
    [bookId],
  );
  return c.json({items:result.rows});
});

reportRoutes.get("/receivables-payables",async (c) => {
  const {pool,bookId} = await context(c);
  const result = await pool.query(
    `SELECT c.id,c.name,c.contact_type AS "contactType",a.currency_code AS "currencyCode",
            (CASE WHEN a.normal_balance='DEBIT'
              THEN COALESCE(SUM(CASE WHEN t.id IS NULL THEN 0 WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0)
              ELSE COALESCE(SUM(CASE WHEN t.id IS NULL THEN 0 WHEN e.direction='CREDIT' THEN e.base_amount ELSE -e.base_amount END),0)
            END)::text balance
     FROM contacts c JOIN accounts a ON a.contact_id=c.id
     LEFT JOIN transaction_entries e ON e.account_id=a.id
     LEFT JOIN transactions t ON t.id=e.transaction_id AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
     WHERE c.book_id=$1 AND c.deleted_at IS NULL GROUP BY c.id,a.id ORDER BY c.name`,
    [bookId],
  );
  return c.json({items:result.rows});
});
