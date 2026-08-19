import { AppError } from "../../common/errors";
import type { DbClient } from "../../infrastructure/database";
import { fetchTcmbRates } from "./currency.provider";

const runProjection = `id,kind,target_date::text AS "targetDate",status,total_items AS "totalItems",
  processed_items AS "processedItems",updated_items AS "updatedItems",missing_items AS "missingItems",
  failed_items AS "failedItems",started_at AS "startedAt",completed_at AS "completedAt",created_at AS "createdAt"`;

export async function listCurrencies(client: DbClient, bookId: string) {
  const result = await client.query(
    // TRY is the book's base currency, so it's always selectable even when
    // no book_currencies row was ever seeded for it - only foreign currencies
    // need an explicit opt-in.
    `SELECT c.code,c.name_tr AS "nameTr",c.name_en AS "nameEn",
       (c.code='TRY' OR bc.currency_code IS NOT NULL) AS "isEnabled"
     FROM currencies c
     LEFT JOIN book_currencies bc ON bc.currency_code=c.code AND bc.book_id=$1
     WHERE c.is_active=true ORDER BY (c.code='TRY') DESC,c.name_tr`,
    [bookId],
  );
  return { items: result.rows };
}

export async function enableCurrency(client: DbClient, bookId: string, code: string) {
  const known = await client.query(`SELECT 1 FROM currencies WHERE code=$1 AND is_active=true`, [code]);
  if (!known.rowCount) throw new AppError(422, "CURRENCY_INVALID", "Currency is unavailable");
  await client.query(
    `INSERT INTO book_currencies(book_id,currency_code) VALUES($1,$2) ON CONFLICT DO NOTHING`,
    [bookId, code],
  );
  return { code, isEnabled: true as const };
}

export async function disableCurrency(client: DbClient, bookId: string, code: string) {
  const used = await client.query(
    `SELECT 1 FROM investment_instruments WHERE book_id=$1 AND currency_code=$2 AND deleted_at IS NULL LIMIT 1`,
    [bookId, code],
  );
  if (used.rowCount) throw new AppError(409, "CURRENCY_IN_USE", "Currency is used by an investment instrument");
  await client.query(`DELETE FROM book_currencies WHERE book_id=$1 AND currency_code=$2`, [bookId, code]);
  return { code, isEnabled: false as const };
}

export async function createCurrencySyncRun(
  client: DbClient,
  targetDate: string,
  trigger: "MANUAL" | "SCHEDULED",
  requestedByUserId?: string,
) {
  const active = await client.query(
    `SELECT ${runProjection} FROM market_data_sync_runs
     WHERE kind='CURRENCY_RATES' AND target_date=$1 AND status IN ('QUEUED','RUNNING')
     ORDER BY created_at DESC LIMIT 1`,
    [targetDate],
  );
  if (active.rows[0]) return active.rows[0];
  const result = await client.query(
    `INSERT INTO market_data_sync_runs(kind,target_date,trigger,status,requested_by_user_id)
     VALUES('CURRENCY_RATES',$1,$2,'QUEUED',$3) RETURNING ${runProjection}`,
    [targetDate, trigger, requestedByUserId ?? null],
  );
  return result.rows[0];
}

export async function latestCurrencySyncRun(client: DbClient, targetDate: string) {
  const result = await client.query(
    `SELECT ${runProjection} FROM market_data_sync_runs
     WHERE kind='CURRENCY_RATES' AND target_date=$1 ORDER BY created_at DESC LIMIT 1`,
    [targetDate],
  );
  return result.rows[0] ?? null;
}

export async function syncCurrencyRates(client: DbClient, targetDate: string, fetcher: typeof fetch = fetch) {
  // Mirrors syncMarketCatalog's reclaim: a run stuck in QUEUED/RUNNING past this
  // window means its Worker invocation was terminated before reaching a
  // terminal status, so it must not block every later attempt forever.
  await client.query(
    `UPDATE market_data_sync_runs SET status='FAILED',error_message='Abandoned: no update within the expected sync window',completed_at=now(),updated_at=now()
     WHERE kind='CURRENCY_RATES' AND target_date=$1 AND status IN ('QUEUED','RUNNING') AND started_at<now()-interval '10 minutes'`,
    [targetDate],
  );
  const run = await createCurrencySyncRun(client, targetDate, "SCHEDULED");
  if (run.status !== "QUEUED") return run;
  await client.query(
    `UPDATE market_data_sync_runs SET status='RUNNING',started_at=now(),updated_at=now() WHERE id=$1`,
    [run.id],
  );
  try {
    const bulletin = await fetchTcmbRates(targetDate, fetcher);
    const points = bulletin?.points ?? [];
    if (points.length > 0) {
      const known = await client.query<{code:string}>(`SELECT code FROM currencies WHERE is_active=true`);
      const knownCodes = new Set(known.rows.map((row) => row.code));
      const values: unknown[] = [];
      const rows: string[] = [];
      for (const point of points) {
        if (!knownCodes.has(point.currencyCode)) continue;
        const offset = rows.length * 3;
        values.push(point.currencyCode, targetDate, point.tryRate);
        rows.push(`($${offset + 1},$${offset + 2},$${offset + 3},'TCMB',now())`);
      }
      if (rows.length > 0) {
        await client.query(
          `INSERT INTO currency_daily_rates(currency_code,rate_date,try_rate,source,fetched_at)
           VALUES ${rows.join(",")}
           ON CONFLICT(currency_code,rate_date) DO UPDATE SET try_rate=excluded.try_rate,
             source=excluded.source,fetched_at=excluded.fetched_at`,
          values,
        );
      }
    }
    const updated = points.length;
    const total = bulletin ? updated : 0;
    await client.query(
      `UPDATE market_data_sync_runs SET status='COMPLETED',total_items=$2,processed_items=$2,
         updated_items=$2,missing_items=0,completed_at=now(),updated_at=now() WHERE id=$1`,
      [run.id, total],
    );
  } catch (error) {
    await client.query(
      `UPDATE market_data_sync_runs SET status='FAILED',error_message=$2,completed_at=now(),updated_at=now() WHERE id=$1`,
      [run.id, error instanceof Error ? error.message.slice(0, 1000) : "Currency rate synchronization failed"],
    );
    throw error;
  }
  return (await latestCurrencySyncRun(client, targetDate))!;
}

export async function listBookCurrencyRates(client: DbClient, bookId: string, targetDate: string) {
  const result = await client.query(
    `SELECT bc.currency_code AS "currencyCode",$2::date::text AS "rateDate",
       COALESCE(r.try_rate,0)::text AS "tryRate",(r.try_rate IS NOT NULL) AS available,
       CASE WHEN r.try_rate IS NOT NULL THEN 'TCMB' ELSE 'MISSING' END AS source
     FROM book_currencies bc
     LEFT JOIN currency_daily_rates r ON r.currency_code=bc.currency_code AND r.rate_date=$2::date
     WHERE bc.book_id=$1 ORDER BY bc.currency_code`,
    [bookId, targetDate],
  );
  return { items: result.rows };
}
