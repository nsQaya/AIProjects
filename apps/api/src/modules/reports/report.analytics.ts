import type { ReportAnalyticsResponse, ReportGranularity } from "@defterx/contracts";
import type { DbClient } from "../../infrastructure/database";

interface AnalyticsInput {
  accountIds: readonly string[];
  bookId: string;
  from: string;
  granularity: ReportGranularity;
  includeAllAccounts: boolean;
  to: string;
}

const intervals: Record<ReportGranularity, string> = {
  day: "1 day",
  week: "1 week",
  month: "1 month",
  year: "1 year",
};

const formats: Record<ReportGranularity, string> = {
  day: "YYYY-MM-DD",
  week: "YYYY-MM-DD",
  month: "YYYY-MM",
  year: "YYYY",
};

const accountScope = `
  SELECT id,name,currency_code,sort_order
  FROM accounts
  WHERE book_id=$1 AND is_system=false AND deleted_at IS NULL
    AND ($5::boolean OR id=ANY($4::uuid[]))`;

function addDecimalStrings(left: string, right: string): string {
  const parts = [left, right].map((value) => {
    const negative = value.startsWith("-");
    const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
    return { negative, whole: whole!, fraction };
  });
  const scale = Math.max(...parts.map((part) => part.fraction.length));
  const values = parts.map((part) => {
    const units = BigInt(`${part.whole}${part.fraction.padEnd(scale, "0")}`);
    return part.negative ? -units : units;
  });
  const total = values[0]! + values[1]!;
  const sign = total < 0n ? "-" : "";
  const digits = (total < 0n ? -total : total).toString().padStart(scale + 1, "0");
  if (scale === 0) return `${sign}${digits}`;
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, "");
  return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
}

export async function loadReportAnalytics(
  pool: DbClient,
  input: AnalyticsInput,
): Promise<ReportAnalyticsResponse> {
  const { accountIds, bookId, from, granularity, includeAllAccounts, to } = input;
  const interval = intervals[granularity];
  const format = formats[granularity];
  const scopeValues = [bookId, from, to, accountIds, includeAllAccounts];
  const seriesValues = [...scopeValues, granularity, interval, format];

  const [book, trend, accountBalances, breakdown, transactions, liquidity, events, investments, investmentValues, cash] =
    await Promise.all([
      pool.query<{ currencyCode: string }>(
        `SELECT base_currency AS "currencyCode" FROM books WHERE id=$1 AND deleted_at IS NULL`,
        [bookId],
      ),
      pool.query(
        `WITH selected_accounts AS (${accountScope}), periods AS (
           SELECT generate_series(date_trunc($6,$2::timestamptz),date_trunc($6,$3::timestamptz),$7::interval) bucket
         ), totals AS (
           SELECT date_trunc($6,t.transaction_date) bucket,
             SUM(CASE WHEN a.account_type='SYSTEM_INCOME' AND e.direction='CREDIT' THEN e.base_amount
                      WHEN a.account_type='SYSTEM_INCOME' THEN -e.base_amount ELSE 0 END) income,
             SUM(CASE WHEN a.account_type='SYSTEM_EXPENSE' AND e.direction='DEBIT' THEN e.base_amount
                      WHEN a.account_type='SYSTEM_EXPENSE' THEN -e.base_amount ELSE 0 END) expense
           FROM transaction_entries e
           JOIN accounts a ON a.id=e.account_id
           JOIN transactions t ON t.id=e.transaction_id
           WHERE t.book_id=$1 AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
             AND t.transaction_date BETWEEN $2 AND $3
             AND EXISTS (
               SELECT 1 FROM transaction_entries scoped_e
               JOIN selected_accounts scoped_a ON scoped_a.id=scoped_e.account_id
               WHERE scoped_e.transaction_id=t.id
             )
           GROUP BY 1
         )
         SELECT to_char(p.bucket,$8) period,to_char(p.bucket,'YYYY-MM') AS month,p.bucket AS "periodStart",
                COALESCE(t.income,0)::text income,COALESCE(t.expense,0)::text expense,
                (COALESCE(t.income,0)-COALESCE(t.expense,0))::text net,
                COALESCE(b.balance,0)::text balance
         FROM periods p
         LEFT JOIN totals t ON t.bucket=p.bucket
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0) balance
           FROM transaction_entries e
           JOIN transactions bt ON bt.id=e.transaction_id AND bt.status='POSTED' AND bt.transaction_type<>'REVERSAL'
           JOIN selected_accounts sa ON sa.id=e.account_id
           WHERE bt.transaction_date < p.bucket+$7::interval AND bt.transaction_date <= $3::timestamptz
         ) b ON true
         ORDER BY p.bucket`,
        seriesValues,
      ),
      pool.query(
        `WITH selected_accounts AS (${accountScope}), periods AS (
           SELECT generate_series(date_trunc($6,$2::timestamptz),date_trunc($6,$3::timestamptz),$7::interval) bucket
         )
         SELECT sa.id AS "accountId",sa.name,sa.currency_code AS "currencyCode",
                to_char(p.bucket,$8) period,p.bucket AS "periodStart",COALESCE(b.balance,0)::text balance
         FROM periods p CROSS JOIN selected_accounts sa
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0) balance
           FROM transaction_entries e
           JOIN transactions t ON t.id=e.transaction_id AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
           WHERE e.account_id=sa.id AND t.transaction_date < p.bucket+$7::interval
             AND t.transaction_date <= $3::timestamptz
         ) b ON true
         ORDER BY p.bucket,sa.sort_order,sa.name`,
        seriesValues,
      ),
      pool.query(
        `WITH selected_accounts AS (${accountScope})
         SELECT c.id AS "categoryId",c.name AS "categoryName",c.category_type AS "categoryType",
                cc.id AS "costCenterId",cc.name AS "costCenterName",
                COALESCE(SUM(CASE
                  WHEN c.category_type='INCOME' AND e.direction='CREDIT' THEN e.base_amount
                  WHEN c.category_type='EXPENSE' AND e.direction='DEBIT' THEN e.base_amount
                  ELSE -e.base_amount END),0)::text amount
         FROM categories c
         JOIN transaction_entries e ON e.account_id=c.system_account_id
         JOIN transactions t ON t.id=e.transaction_id
         LEFT JOIN cost_centers cc ON cc.id=t.cost_center_id
         WHERE c.book_id=$1 AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
           AND t.transaction_date BETWEEN $2 AND $3
           AND EXISTS (
             SELECT 1 FROM transaction_entries scoped_e
             JOIN selected_accounts scoped_a ON scoped_a.id=scoped_e.account_id
             WHERE scoped_e.transaction_id=t.id
           )
         GROUP BY c.id,cc.id,cc.name
         HAVING SUM(CASE
           WHEN c.category_type='INCOME' AND e.direction='CREDIT' THEN e.base_amount
           WHEN c.category_type='EXPENSE' AND e.direction='DEBIT' THEN e.base_amount
           ELSE -e.base_amount END)<>0
         ORDER BY c.category_type,c.name,cc.name NULLS LAST`,
        scopeValues,
      ),
      pool.query(
        `WITH selected_accounts AS (${accountScope})
         SELECT t.id,t.transaction_type AS type,t.title,t.transaction_date AS "transactionDate",
                t.category_id AS "categoryId",c.name AS "categoryName",
                t.cost_center_id AS "costCenterId",cc.name AS "costCenterName",
                source.name AS "accountName",t.currency_code AS "currencyCode",entry.amount::text amount
         FROM transactions t
         LEFT JOIN categories c ON c.id=t.category_id
         LEFT JOIN cost_centers cc ON cc.id=t.cost_center_id
         LEFT JOIN accounts source ON source.id=t.account_id
         LEFT JOIN LATERAL (
           SELECT e.amount FROM transaction_entries e
           JOIN selected_accounts sa ON sa.id=e.account_id
           WHERE e.transaction_id=t.id ORDER BY e.created_at,e.id LIMIT 1
         ) entry ON true
         WHERE t.book_id=$1 AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
           AND t.transaction_date BETWEEN $2 AND $3 AND entry.amount IS NOT NULL
         ORDER BY t.transaction_date DESC,t.transaction_no DESC LIMIT 200`,
        scopeValues,
      ),
      pool.query(
        `WITH selected_accounts AS (${accountScope}), periods AS (
           SELECT generate_series(date_trunc($6,$2::timestamptz),date_trunc($6,$3::timestamptz),$7::interval) bucket
         ), opening AS (
           SELECT COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0) balance
           FROM selected_accounts sa
           JOIN transaction_entries e ON e.account_id=sa.id
           JOIN transactions t ON t.id=e.transaction_id AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
           WHERE t.transaction_date < $2::timestamptz
         ), event_impacts AS (
           SELECT t.transaction_date AS at,
             CASE WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END impact
           FROM selected_accounts sa
           JOIN transaction_entries e ON e.account_id=sa.id
           JOIN transactions t ON t.id=e.transaction_id AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
           WHERE t.transaction_date BETWEEN $2 AND $3
           UNION ALL
           SELECT s.scheduled_at AS at,
             CASE WHEN s.transaction_type IN ('INCOME','COLLECTION','SALE') THEN s.amount ELSE -s.amount END impact
           FROM scheduled_transactions s JOIN selected_accounts sa ON sa.id=s.account_id
           WHERE s.book_id=$1 AND s.status IN ('PENDING','OVERDUE') AND s.deleted_at IS NULL
             AND s.scheduled_at BETWEEN $2 AND $3
           UNION ALL
           SELECT s.scheduled_at AS at,s.amount impact
           FROM scheduled_transactions s JOIN selected_accounts sa ON sa.id=s.target_account_id
           WHERE s.book_id=$1 AND s.transaction_type='TRANSFER'
             AND s.status IN ('PENDING','OVERDUE') AND s.deleted_at IS NULL
             AND s.scheduled_at BETWEEN $2 AND $3
         ), totals AS (
           SELECT date_trunc($6,at) bucket,
                  COALESCE(SUM(impact) FILTER (WHERE impact>0),0) inflow,
                  COALESCE(-SUM(impact) FILTER (WHERE impact<0),0) outflow,
                  COALESCE(SUM(impact),0) net
           FROM event_impacts GROUP BY 1
         )
         SELECT to_char(p.bucket,$8) period,p.bucket AS "periodStart",
                COALESCE(t.inflow,0)::text inflow,COALESCE(t.outflow,0)::text outflow,
                COALESCE(t.net,0)::text net,
                ((SELECT balance FROM opening)+SUM(COALESCE(t.net,0)) OVER (ORDER BY p.bucket))::text AS "projectedBalance",
                (SELECT balance::text FROM opening) AS "openingBalance"
         FROM periods p LEFT JOIN totals t ON t.bucket=p.bucket ORDER BY p.bucket`,
        seriesValues,
      ),
      pool.query(
        `WITH selected_accounts AS (${accountScope}), impacts AS (
           SELECT s.id,s.title,s.scheduled_at AS "scheduledAt",s.transaction_type AS type,
             CASE WHEN s.transaction_type IN ('INCOME','COLLECTION','SALE') THEN s.amount ELSE -s.amount END impact
           FROM scheduled_transactions s JOIN selected_accounts sa ON sa.id=s.account_id
           WHERE s.book_id=$1 AND s.status IN ('PENDING','OVERDUE') AND s.deleted_at IS NULL
             AND s.scheduled_at BETWEEN $2 AND $3
           UNION ALL
           SELECT s.id,s.title,s.scheduled_at,s.transaction_type,s.amount impact
           FROM scheduled_transactions s JOIN selected_accounts sa ON sa.id=s.target_account_id
           WHERE s.book_id=$1 AND s.transaction_type='TRANSFER'
             AND s.status IN ('PENDING','OVERDUE') AND s.deleted_at IS NULL
             AND s.scheduled_at BETWEEN $2 AND $3
         )
         SELECT id,title,"scheduledAt",type,SUM(impact)::text impact
         FROM impacts GROUP BY id,title,"scheduledAt",type
         HAVING SUM(impact)<>0 ORDER BY "scheduledAt",title LIMIT 200`,
        scopeValues,
      ),
      pool.query(
        `WITH selected_accounts AS (${accountScope}), periods AS (
           SELECT generate_series(date_trunc($6,$2::timestamptz),date_trunc($6,$3::timestamptz),$7::interval) bucket
         ), positions_at_period AS (
           SELECT p.bucket,
             COALESCE(SUM(
               (l.quantity - COALESCE(SUM(s.quantity) FILTER (WHERE s.sold_at <= p.bucket), 0)) *
               COALESCE(latest_price.price, 0) *
               COALESCE(fx.try_rate, 1)
             ), 0) value
           FROM periods p
           CROSS JOIN investment_lots l
           JOIN investment_instruments i ON i.id=l.instrument_id
           LEFT JOIN selected_accounts sa ON sa.id=l.account_id
           LEFT JOIN investment_sales s ON s.book_id=$1 AND s.instrument_id=l.instrument_id AND s.deleted_at IS NULL
           LEFT JOIN LATERAL (
             SELECT candidate.price FROM (
               SELECT ip.price,ip.priced_at,0 priority FROM investment_prices ip
               WHERE ip.instrument_id=i.id AND ip.priced_at <= p.bucket
               UNION ALL
               SELECT mp.close AS price,(mp.price_date::timestamp AT TIME ZONE 'Europe/Istanbul'),1 priority
               FROM market_daily_prices mp WHERE mp.market_symbol_id=i.market_symbol_id
                 AND mp.price_date<=($3::timestamptz AT TIME ZONE 'Europe/Istanbul')::date
             ) candidate ORDER BY candidate.priced_at DESC,candidate.priority LIMIT 1
           ) latest_price ON true
           LEFT JOIN LATERAL (
             SELECT try_rate FROM currency_daily_rates
             WHERE currency_code=i.currency_code ORDER BY rate_date DESC LIMIT 1
           ) fx ON i.currency_code<>'TRY'
           WHERE l.book_id=$1 AND l.deleted_at IS NULL
             AND ($5::boolean OR sa.id IS NOT NULL)
             AND l.purchased_at <= p.bucket
           GROUP BY p.bucket
         )
         SELECT to_char(p.bucket,$8) period,p.bucket AS "periodStart",COALESCE(pap.value,0)::text value
         FROM periods p
         LEFT JOIN positions_at_period pap ON pap.bucket=p.bucket
         ORDER BY p.bucket`,
        seriesValues,
      ),
      pool.query(
        `WITH selected_accounts AS (${accountScope}), scoped_purchases AS (
           SELECT l.instrument_id,SUM(l.quantity) quantity,SUM(l.quantity*l.unit_price) cost_basis
           FROM investment_lots l
           LEFT JOIN selected_accounts sa ON sa.id=l.account_id
           WHERE l.book_id=$1 AND l.deleted_at IS NULL AND l.purchased_at <= $3::timestamptz
             AND ($5::boolean OR sa.id IS NOT NULL)
           GROUP BY l.instrument_id
         ), all_purchases AS (
           SELECT instrument_id,SUM(quantity) quantity,SUM(quantity*unit_price) cost_basis
           FROM investment_lots
           WHERE book_id=$1 AND deleted_at IS NULL AND purchased_at <= $3::timestamptz
           GROUP BY instrument_id
         ), sales AS (
           SELECT instrument_id,SUM(quantity) quantity,SUM(cost_basis) cost_basis,
                  SUM(quantity*unit_price-cost_basis) FILTER (WHERE sold_at BETWEEN $2 AND $3) realized_gain
           FROM investment_sales
           WHERE book_id=$1 AND deleted_at IS NULL AND sold_at <= $3::timestamptz
           GROUP BY instrument_id
         ), positions AS (
           SELECT i.id AS "instrumentId",i.name,i.symbol,t.name AS "assetTypeName",i.currency_code AS "currencyCode",
             GREATEST(sp.quantity-COALESCE(s.quantity,0)*(sp.quantity/NULLIF(ap.quantity,0)),0) quantity,
             GREATEST(sp.cost_basis-COALESCE(s.cost_basis,0)*(sp.cost_basis/NULLIF(ap.cost_basis,0)),0) cost_basis,
             COALESCE(s.realized_gain,0)*(sp.cost_basis/NULLIF(ap.cost_basis,0)) realized_gain,
             latest.price,latest.priced_at,
             CASE WHEN i.currency_code='TRY' THEN 1 ELSE fx.try_rate END AS try_rate
           FROM scoped_purchases sp JOIN all_purchases ap ON ap.instrument_id=sp.instrument_id
           JOIN investment_instruments i ON i.id=sp.instrument_id
           JOIN investment_asset_types t ON t.id=i.asset_type_id
           LEFT JOIN sales s ON s.instrument_id=i.id
           LEFT JOIN LATERAL (
             SELECT candidate.price,candidate.priced_at FROM (
               SELECT ip.price,ip.priced_at,0 priority FROM investment_prices ip
               WHERE ip.instrument_id=i.id AND ip.priced_at <= $3::timestamptz
               UNION ALL
               SELECT mp.close,(mp.price_date::timestamp AT TIME ZONE 'Europe/Istanbul'),1 priority
               FROM market_daily_prices mp
               WHERE mp.market_symbol_id=i.market_symbol_id
                 AND mp.price_date<=($3::timestamptz AT TIME ZONE 'Europe/Istanbul')::date
             ) candidate ORDER BY candidate.priced_at DESC,candidate.priority LIMIT 1
           ) latest ON true
           -- Latest known TCMB rate as of today (not scoped to $3) so a
           -- historical report still values today's holdings at a real rate
           -- rather than silently dropping them from the TRY totals.
           LEFT JOIN LATERAL (
             SELECT try_rate FROM currency_daily_rates
             WHERE currency_code=i.currency_code ORDER BY rate_date DESC LIMIT 1
           ) fx ON i.currency_code<>'TRY'
         )
         SELECT "instrumentId",name,symbol,"assetTypeName","currencyCode",quantity::text,
                cost_basis::text AS "costBasis",
                CASE WHEN price IS NULL THEN NULL ELSE (quantity*price)::text END AS "currentValue",
                realized_gain::text AS "realizedGain",
                CASE WHEN price IS NULL THEN NULL ELSE (quantity*price-cost_basis)::text END AS "unrealizedGain",
                priced_at AS "latestPriceAt",
                CASE WHEN price IS NULL OR try_rate IS NULL THEN NULL ELSE (quantity*price*try_rate)::text END AS "currentValueTRY",
                CASE WHEN price IS NULL OR try_rate IS NULL THEN NULL ELSE (quantity*price*try_rate-cost_basis*try_rate)::text END AS "unrealizedGainTRY",
                CASE WHEN try_rate IS NULL THEN NULL ELSE (cost_basis*try_rate)::text END AS "costBasisTRY",
                CASE WHEN try_rate IS NULL THEN NULL ELSE (realized_gain*try_rate)::text END AS "realizedGainTRY",
                COALESCE(SUM(cost_basis*try_rate) OVER (),0)::text AS "investmentCost",
                COALESCE(SUM(CASE WHEN try_rate IS NULL THEN 0 ELSE COALESCE(quantity*price,cost_basis)*try_rate END) OVER (),0)::text AS "investmentValue",
                COALESCE(SUM(realized_gain) OVER (),0)::text AS "totalRealizedGain",
                COALESCE(SUM(CASE WHEN price IS NULL OR try_rate IS NULL THEN 0 ELSE quantity*price*try_rate-cost_basis*try_rate END) OVER (),0)::text AS "totalUnrealizedGain"
         FROM positions WHERE quantity>0 OR realized_gain<>0 ORDER BY "assetTypeName",name`,
        scopeValues,
      ),
      pool.query<{ cashBalance: string }>(
        `WITH selected_accounts AS (${accountScope})
         SELECT COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0)::text AS "cashBalance"
         FROM selected_accounts sa
         JOIN transaction_entries e ON e.account_id=sa.id
         JOIN transactions t ON t.id=e.transaction_id AND t.status='POSTED' AND t.transaction_type<>'REVERSAL'
         WHERE t.transaction_date <= $3::timestamptz
           AND $2::timestamptz <= $3::timestamptz`,
        scopeValues,
      ),
    ]);

  const balanceRows = accountBalances.rows as Array<{
    accountId: string;
    balance: string;
    currencyCode: string;
    name: string;
    period: string;
    periodStart: string;
  }>;
  const accounts = [...new Map(balanceRows.map((row) => [row.accountId, {
    id: row.accountId,
    name: row.name,
    currencyCode: row.currencyCode,
  }])).values()];
  const investmentRows = investments.rows as Array<Record<string, string | null>>;
  const investmentTotals = investmentRows[0] ?? {};
  const cashBalance = cash.rows[0]?.cashBalance ?? "0";
  const investmentValue = investmentTotals.investmentValue ?? "0";
  const totalAssets = addDecimalStrings(cashBalance, investmentValue);
  const liquidityRows = liquidity.rows as Array<Record<string, string>>;

  return {
    from,
    to,
    granularity,
    currencyCode: book.rows[0]!.currencyCode,
    trend: trend.rows as ReportAnalyticsResponse["trend"],
    accountBalances: {
      accounts: accounts as ReportAnalyticsResponse["accountBalances"]["accounts"],
      items: balanceRows.map(({ accountId, balance, period, periodStart }) => ({
        accountId,
        balance,
        period,
        periodStart,
      })) as ReportAnalyticsResponse["accountBalances"]["items"],
    },
    categoryDetail: {
      breakdown: breakdown.rows as ReportAnalyticsResponse["categoryDetail"]["breakdown"],
      transactions: transactions.rows as ReportAnalyticsResponse["categoryDetail"]["transactions"],
    },
    liquidity: {
      openingBalance: liquidityRows[0]?.openingBalance ?? "0",
      items: liquidityRows.map(({ openingBalance: _openingBalance, ...row }) => row) as unknown as ReportAnalyticsResponse["liquidity"]["items"],
      events: events.rows as ReportAnalyticsResponse["liquidity"]["events"],
    },
    investmentValueSeries: investmentValues.rows as ReportAnalyticsResponse["investmentValueSeries"],
    netWorth: {
      cashBalance,
      investmentCost: investmentTotals.investmentCost ?? "0",
      investmentValue,
      realizedGain: investmentTotals.totalRealizedGain ?? "0",
      unrealizedGain: investmentTotals.totalUnrealizedGain ?? "0",
      totalAssets,
      items: investmentRows.map(({ investmentCost: _investmentCost, investmentValue: _investmentValue,
        totalRealizedGain: _totalRealizedGain, totalUnrealizedGain: _totalUnrealizedGain, ...row }) => row) as unknown as ReportAnalyticsResponse["netWorth"]["items"],
    },
  };
}
