import type { DbClient } from "../../infrastructure/database";
import type { BackgroundJob, PriceSyncMode } from "../../config/bindings";
import {
  fetchMarketCatalog,
  fetchYahooLivePrices,
  fetchYahooPrices,
  fetchYahooSplits,
  type MarketCatalogItem,
} from "./market-data.provider";
import { fetchTefasFundPrices } from "../funds/fund.provider";

const catalogBatchSize = 400;
const priceBatchSize = 20;

export interface PriceSyncRun {
  completedAt: string | null;
  createdAt: string;
  failedItems: number;
  id: string;
  kind: "PRICES";
  missingItems: number;
  processedItems: number;
  startedAt: string | null;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  targetDate: string;
  totalItems: number;
  updatedItems: number;
}

interface PriceJobItem {
  id: string;
  symbol: string;
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function upsertCatalogBatch(client: DbClient, items: readonly MarketCatalogItem[], seenAt: Date) {
  if (items.length === 0) return;
  const values: unknown[] = [];
  const rows = items.map((item, index) => {
    const offset = index * 9;
    values.push(
      item.catalogSource,item.providerSymbol,item.exchangeCode,item.market,item.instrumentType,
      item.name,item.currencyCode,seenAt,seenAt,
    );
    return `($${offset + 1},'YAHOO',$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7},true,$${offset + 8},$${offset + 9})`;
  });
  await client.query(
    `INSERT INTO market_symbols(
       catalog_source,price_provider,provider_symbol,exchange_code,market,instrument_type,name,currency_code,
       is_active,first_seen_at,last_seen_at
     ) VALUES ${rows.join(",")}
     ON CONFLICT(price_provider,provider_symbol) DO UPDATE SET
       catalog_source=excluded.catalog_source,exchange_code=excluded.exchange_code,market=excluded.market,
       instrument_type=excluded.instrument_type,name=excluded.name,currency_code=excluded.currency_code,
       is_active=true,last_seen_at=excluded.last_seen_at,updated_at=now()`,
    values,
  );
}

export async function syncMarketCatalog(client: DbClient, fetcher: typeof fetch = fetch) {
  // A run stuck in QUEUED/RUNNING past this window means its Worker invocation
  // was terminated before it could reach a terminal status (e.g. concurrent
  // syncs contending on the same upsert). Reclaim it so syncing isn't blocked
  // forever by an abandoned run.
  await client.query(
    `UPDATE market_data_sync_runs SET status='FAILED',error_message='Abandoned: no update within the expected sync window',completed_at=now(),updated_at=now()
     WHERE kind='CATALOG' AND status IN ('QUEUED','RUNNING') AND started_at<now()-interval '10 minutes'`,
  );
  const active = await client.query(
    `SELECT 1 FROM market_data_sync_runs WHERE kind='CATALOG' AND status IN ('QUEUED','RUNNING') LIMIT 1`,
  );
  if (active.rowCount) return;
  const run = await client.query<{id:string}>(
    `INSERT INTO market_data_sync_runs(kind,trigger,status,started_at) VALUES('CATALOG','SCHEDULED','RUNNING',now()) RETURNING id`,
  );
  const runId = run.rows[0]!.id;
  try {
    const items = await fetchMarketCatalog(fetcher);
    const seenAt = new Date();
    await client.query("BEGIN");
    try {
      for (const batch of chunks(items,catalogBatchSize)) await upsertCatalogBatch(client,batch,seenAt);
      await client.query(
        `UPDATE market_symbols SET is_active=false,updated_at=now()
         WHERE is_active=true AND last_seen_at<$1 AND market IN ('US','BIST')`,
        [seenAt],
      );
      await client.query(
        `UPDATE investment_instruments i SET market_symbol_id=s.id,symbol=s.provider_symbol,
             currency_code=s.currency_code,updated_at=now(),version=i.version+1
         FROM market_symbols s
         WHERE i.market_symbol_id IS NULL AND i.deleted_at IS NULL AND i.symbol IS NOT NULL
           AND s.is_active=true AND (
             upper(i.symbol)=s.provider_symbol OR
             (s.market='BIST' AND upper(i.symbol)||'.IS'=s.provider_symbol)
           )`,
      );
      await client.query(
        `UPDATE market_data_sync_runs SET status='COMPLETED',total_items=$2,processed_items=$2,
           updated_items=$2,completed_at=now(),updated_at=now() WHERE id=$1`,
        [runId,items.length],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
    return { runId, totalItems: items.length };
  } catch (error) {
    await client.query(
      `UPDATE market_data_sync_runs SET status='FAILED',error_message=$2,completed_at=now(),updated_at=now() WHERE id=$1`,
      [runId,error instanceof Error ? error.message.slice(0,1000) : "Catalog synchronization failed"],
    );
    throw error;
  }
}

export async function searchMarketSymbols(client: DbClient, query: string, market?: "BIST" | "US", limit=30) {
  const normalized = query.trim();
  const result = await client.query(
    `SELECT id,provider_symbol AS "providerSymbol",exchange_code AS "exchangeCode",market,
            instrument_type AS "instrumentType",name,currency_code AS "currencyCode"
     FROM market_symbols
     WHERE is_active=true AND ($1::text IS NULL OR market=$1)
       AND ($2='' OR provider_symbol ILIKE '%'||$2||'%' OR name ILIKE '%'||$2||'%')
     ORDER BY CASE WHEN upper(provider_symbol)=upper($2) THEN 0
                   WHEN provider_symbol ILIKE $2||'%' THEN 1 ELSE 2 END,
              provider_symbol
     LIMIT $3`,
    [market??null,normalized,limit],
  );
  return { items: result.rows };
}

const runProjection = `id,kind,target_date::text AS "targetDate",status,total_items AS "totalItems",
  processed_items AS "processedItems",updated_items AS "updatedItems",missing_items AS "missingItems",
  failed_items AS "failedItems",started_at AS "startedAt",completed_at AS "completedAt",created_at AS "createdAt"`;

// A PRICES run only reaches COMPLETED once every queued batch reports back; if a
// batch exhausts its retries the run sits in QUEUED/RUNNING forever, which both
// blocks createPriceSyncRun's dedup (you can't start a new one for that day) and
// keeps the settings page's "sync running" button disabled. Retire any run that
// has not recorded progress within this window so it can be re-triggered.
const staleRunInterval = "15 minutes";

export async function reclaimStalePriceRuns(client: DbClient) {
  await client.query(
    `UPDATE market_data_sync_runs
       SET status='FAILED',
           error_message=COALESCE(error_message,'Abandoned: a price batch did not finish within the expected window'),
           completed_at=now(),updated_at=now()
     WHERE kind='PRICES' AND status IN ('QUEUED','RUNNING')
       AND updated_at < now() - interval '${staleRunInterval}'`,
  );
}

export async function createPriceSyncRun(
  client: DbClient,
  targetDate: string,
  trigger: "MANUAL" | "SCHEDULED",
  requestedByUserId?: string,
): Promise<PriceSyncRun> {
  await reclaimStalePriceRuns(client);
  const active = await client.query(
    `SELECT ${runProjection} FROM market_data_sync_runs
     WHERE kind='PRICES' AND target_date=$1 AND status IN ('QUEUED','RUNNING')
     ORDER BY created_at DESC LIMIT 1`,
    [targetDate],
  );
  if (active.rows[0]) return active.rows[0];
  const result = await client.query(
    `INSERT INTO market_data_sync_runs(kind,target_date,trigger,status,requested_by_user_id)
     VALUES('PRICES',$1,$2,'QUEUED',$3) RETURNING ${runProjection}`,
    [targetDate,trigger,requestedByUserId??null],
  );
  return result.rows[0];
}

export async function latestPriceSyncRun(client: DbClient, targetDate: string): Promise<PriceSyncRun | null> {
  const result = await client.query(
    `SELECT ${runProjection} FROM market_data_sync_runs
     WHERE kind='PRICES' AND target_date=$1 ORDER BY created_at DESC LIMIT 1`,
    [targetDate],
  );
  return result.rows[0]??null;
}

export async function ensureMarketData(
  client: DbClient,
  queue: Queue<BackgroundJob>,
  targetDate: string,
) {
  const catalog = await client.query<{fresh:boolean}>(
    `SELECT EXISTS(
       SELECT 1 FROM market_data_sync_runs
       WHERE kind='CATALOG' AND status='COMPLETED' AND completed_at>now()-interval '7 days'
     ) AS fresh`,
  );
  if (!catalog.rows[0]?.fresh) await syncMarketCatalog(client);
  await reclaimStalePriceRuns(client);
  const existing = await latestPriceSyncRun(client,targetDate);
  // Retry a day that has no run yet, or whose last attempt died (stale run just
  // reclaimed above, or a hard failure) - a COMPLETED run is left alone.
  if (!existing || existing.status === "FAILED") {
    const run = await createPriceSyncRun(client,targetDate,"SCHEDULED");
    await queue.send({type:"PLAN_MARKET_PRICES",runId:run.id,targetDate});
  }
}

export async function planPriceSync(
  client: DbClient,
  queue: Queue<BackgroundJob>,
  runId: string,
  targetDate: string,
  mode: PriceSyncMode = "CLOSE",
) {
  // Only the symbols someone actually tracks - across every book, not just the
  // requesting one. The full market_symbols catalog is ~13k codes; fetching all
  // of them every run swamped Yahoo (rate-limited batches would fail and never
  // complete, which is why BIST codes in particular stopped updating).
  const symbols = await client.query<{id:string;symbol:string}>(
    `SELECT DISTINCT s.id,s.provider_symbol AS symbol
     FROM market_symbols s
     JOIN investment_instruments i ON i.market_symbol_id=s.id
     WHERE s.is_active=true AND i.deleted_at IS NULL
     ORDER BY s.id`,
  );
  // Turkish mutual funds have no catalog (TEFAS itself blocks the kind of
  // plain fetch() that builds market_symbols - see fund.provider.ts) - each
  // book's fund instrument carries its own hand-typed TEFAS code instead, so
  // these are queued per-instrument rather than per-symbol.
  const fundInstruments = await client.query<{id:string;symbol:string}>(
    `SELECT i.id,i.symbol FROM investment_instruments i
     JOIN investment_asset_types t ON t.id=i.asset_type_id
     WHERE i.deleted_at IS NULL AND i.market_symbol_id IS NULL AND i.symbol IS NOT NULL AND t.name ILIKE '%fon%'
     ORDER BY i.id`,
  );
  const totalItems = symbols.rows.length + fundInstruments.rows.length;
  const claimed = await client.query(
    `UPDATE market_data_sync_runs SET status='RUNNING',started_at=COALESCE(started_at,now()),
       total_items=$2,updated_at=now() WHERE id=$1 AND status IN ('QUEUED','RUNNING')`,
    [runId,totalItems],
  );
  // The run was already reclaimed/failed (a stale duplicate PLAN job) - don't
  // queue a second wave of batches against it.
  if (!claimed.rowCount) return;
  if (totalItems === 0) {
    await client.query(
      `UPDATE market_data_sync_runs SET status='COMPLETED',completed_at=now(),updated_at=now()
       WHERE id=$1 AND status IN ('QUEUED','RUNNING')`,
      [runId],
    );
    return;
  }
  const messages = [
    ...chunks(symbols.rows,priceBatchSize).map((items,index) => ({
      body: { type: "FETCH_MARKET_PRICE_BATCH", runId, targetDate, mode, batchKey: String(index), items } as BackgroundJob,
    })),
    ...chunks(fundInstruments.rows,priceBatchSize).map((items,index) => ({
      body: { type: "FETCH_FUND_PRICE_BATCH", runId, targetDate, mode, batchKey: `fund:${index}`, items } as BackgroundJob,
    })),
  ];
  for (const group of chunks(messages,100)) await queue.sendBatch(group);
}

async function insertPrices(
  client: DbClient,
  items: readonly PriceJobItem[],
  targetDate: string,
  fetcher: typeof fetch,
  mode: PriceSyncMode = "CLOSE",
) {
  const bySymbol = new Map(items.map((item) => [item.symbol,item]));
  const symbols = items.map((item) => item.symbol);
  const result = mode === "LIVE"
    ? await fetchYahooLivePrices(symbols,targetDate,fetcher)
    : await fetchYahooPrices(symbols,targetDate,fetcher);
  const source = mode === "LIVE" ? "YAHOO_LIVE" : "YAHOO";
  if (result.points.length > 0) {
    const values: unknown[] = [];
    const rows: string[] = [];
    for (const point of result.points) {
      const item = bySymbol.get(point.providerSymbol);
      if (!item) continue;
      const offset = rows.length * 7;
      values.push(item.id,point.priceDate,point.close,point.adjustedClose,point.currencyCode,source,new Date());
      rows.push(`($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},$${offset + 5},$${offset + 6},$${offset + 7})`);
    }
    if (rows.length > 0) {
      await client.query(
        `INSERT INTO market_daily_prices(market_symbol_id,price_date,close,adjusted_close,currency_code,source,fetched_at)
         VALUES ${rows.join(",")}
         ON CONFLICT(market_symbol_id,price_date) DO UPDATE SET close=excluded.close,
           adjusted_close=excluded.adjusted_close,currency_code=excluded.currency_code,
           source=excluded.source,fetched_at=excluded.fetched_at`,
        values,
      );
    }
  }
  return {
    failed: result.failedSymbols.length,
    missing: Math.max(0,items.length-result.points.length-result.failedSymbols.length),
    updated: result.points.length,
  };
}

export async function processPriceBatch(
  client: DbClient,
  job: {batchKey:string;items:PriceJobItem[];runId:string;targetDate:string;mode?:PriceSyncMode},
  fetcher: typeof fetch = fetch,
) {
  const alreadyDone = await client.query(
    `SELECT 1 FROM market_data_sync_batches WHERE run_id=$1 AND batch_key=$2`,
    [job.runId,job.batchKey],
  );
  if (alreadyDone.rowCount) return;
  const counts = await insertPrices(client,job.items,job.targetDate,fetcher,job.mode ?? "CLOSE");
  await client.query("BEGIN");
  try {
    const inserted = await client.query(
      `INSERT INTO market_data_sync_batches(run_id,batch_key,processed_items,updated_items,missing_items,failed_items)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING run_id`,
      [job.runId,job.batchKey,job.items.length,counts.updated,counts.missing,counts.failed],
    );
    if (inserted.rowCount) {
      await client.query(
        `UPDATE market_data_sync_runs SET
           processed_items=processed_items+$2,updated_items=updated_items+$3,
           missing_items=missing_items+$4,failed_items=failed_items+$5,
           status=CASE WHEN processed_items+$2>=total_items THEN 'COMPLETED' ELSE 'RUNNING' END,
           completed_at=CASE WHEN processed_items+$2>=total_items THEN now() ELSE completed_at END,
           updated_at=now() WHERE id=$1 AND status IN ('QUEUED','RUNNING')`,
        [job.runId,job.items.length,counts.updated,counts.missing,counts.failed],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function insertFundPrices(
  client: DbClient,
  items: readonly PriceJobItem[],
  targetDate: string,
  fetcher: typeof fetch,
  mode: PriceSyncMode = "CLOSE",
) {
  const bySymbol = new Map(items.map((item) => [item.symbol.trim().toUpperCase(),item]));
  const result = await fetchTefasFundPrices(items.map((item) => item.symbol),fetcher);
  if (result.points.length > 0) {
    const values: unknown[] = [];
    const rows: string[] = [];
    for (const point of result.points) {
      const item = bySymbol.get(point.symbol);
      if (!item) continue;
      const offset = rows.length * 3;
      // Fixed at Istanbul noon so a same-day rerun updates this exact row
      // instead of piling up duplicate prices for the day, and so it lines
      // up with listBookInstrumentPrices' Europe/Istanbul date join.
      // LIVE (manual "update now") forces the latest NAV onto targetDate even
      // when TEFAS has not published that day's value yet.
      const priceDate = mode === "LIVE" ? targetDate : point.priceDate;
      values.push(item.id,point.price,`${priceDate}T12:00:00+03:00`);
      rows.push(`($${offset + 1},$${offset + 2},$${offset + 3})`);
    }
    if (rows.length > 0) {
      await client.query(
        `INSERT INTO investment_prices(instrument_id,price,priced_at)
         VALUES ${rows.join(",")}
         ON CONFLICT(instrument_id,priced_at) DO UPDATE SET price=excluded.price`,
        values,
      );
    }
  }
  return {
    failed: result.failedSymbols.length,
    missing: Math.max(0,items.length-result.points.length-result.failedSymbols.length),
    updated: result.points.length,
  };
}

export async function processFundPriceBatch(
  client: DbClient,
  job: {batchKey:string;items:PriceJobItem[];runId:string;targetDate:string;mode?:PriceSyncMode},
  fetcher: typeof fetch = fetch,
) {
  const alreadyDone = await client.query(
    `SELECT 1 FROM market_data_sync_batches WHERE run_id=$1 AND batch_key=$2`,
    [job.runId,job.batchKey],
  );
  if (alreadyDone.rowCount) return;
  const counts = await insertFundPrices(client,job.items,job.targetDate,fetcher,job.mode ?? "CLOSE");
  await client.query("BEGIN");
  try {
    const inserted = await client.query(
      `INSERT INTO market_data_sync_batches(run_id,batch_key,processed_items,updated_items,missing_items,failed_items)
       VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING RETURNING run_id`,
      [job.runId,job.batchKey,job.items.length,counts.updated,counts.missing,counts.failed],
    );
    if (inserted.rowCount) {
      await client.query(
        `UPDATE market_data_sync_runs SET
           processed_items=processed_items+$2,updated_items=updated_items+$3,
           missing_items=missing_items+$4,failed_items=failed_items+$5,
           status=CASE WHEN processed_items+$2>=total_items THEN 'COMPLETED' ELSE 'RUNNING' END,
           completed_at=CASE WHEN processed_items+$2>=total_items THEN now() ELSE completed_at END,
           updated_at=now() WHERE id=$1 AND status IN ('QUEUED','RUNNING')`,
        [job.runId,job.items.length,counts.updated,counts.missing,counts.failed],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function queueLinkedSplitBatches(client: DbClient, queue: Queue<BackgroundJob>) {
  const symbols = await client.query<{id:string;symbol:string}>(
    `SELECT DISTINCT s.id,s.provider_symbol AS symbol
     FROM market_symbols s JOIN investment_instruments i ON i.market_symbol_id=s.id
     WHERE s.is_active=true AND i.is_active=true AND i.deleted_at IS NULL ORDER BY s.id`,
  );
  const messages = chunks(symbols.rows,10).map((items) => ({
    body: { type: "FETCH_MARKET_SPLIT_BATCH", items } as BackgroundJob,
  }));
  for (const group of chunks(messages,100)) await queue.sendBatch(group);
}

async function applySplit(
  client: DbClient,
  marketSymbolId: string,
  event: {denominator:string;numerator:string;splitDate:string},
) {
  await client.query("BEGIN");
  try {
    const split = await client.query<{id:string}>(
      `INSERT INTO market_splits(market_symbol_id,split_date,numerator,denominator)
       VALUES($1,$2,$3,$4) ON CONFLICT(market_symbol_id,split_date,numerator,denominator)
       DO UPDATE SET fetched_at=now() RETURNING id`,
      [marketSymbolId,event.splitDate,event.numerator,event.denominator],
    );
    const instruments = await client.query<{book_id:string;id:string}>(
      `SELECT id,book_id FROM investment_instruments
       WHERE market_symbol_id=$1 AND deleted_at IS NULL`,
      [marketSymbolId],
    );
    for (const instrument of instruments.rows) {
      const application = await client.query(
        `INSERT INTO investment_split_applications(book_id,instrument_id,market_split_id)
         VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING id`,
        [instrument.book_id,instrument.id,split.rows[0]!.id],
      );
      if (!application.rowCount) continue;
      const lots = await client.query(
        `UPDATE investment_lots SET quantity=quantity*$3::numeric/$4::numeric,
           unit_price=unit_price*$4::numeric/$3::numeric,updated_at=now(),version=version+1
         WHERE instrument_id=$1 AND purchased_at::date<$2::date AND deleted_at IS NULL`,
        [instrument.id,event.splitDate,event.numerator,event.denominator],
      );
      const sales = await client.query(
        `UPDATE investment_sales SET quantity=quantity*$3::numeric/$4::numeric,
           unit_price=unit_price*$4::numeric/$3::numeric,updated_at=now(),version=version+1
         WHERE instrument_id=$1 AND sold_at::date<$2::date AND deleted_at IS NULL`,
        [instrument.id,event.splitDate,event.numerator,event.denominator],
      );
      await client.query(
        `UPDATE investment_split_applications SET affected_lots=$2,affected_sales=$3 WHERE instrument_id=$1 AND market_split_id=$4`,
        [instrument.id,lots.rowCount??0,sales.rowCount??0,split.rows[0]!.id],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function processSplitBatch(
  client: DbClient,
  items: readonly PriceJobItem[],
  fetcher: typeof fetch = fetch,
) {
  for (const item of items) {
    const events = await fetchYahooSplits(item.symbol,fetcher);
    for (const event of events) await applySplit(client,item.id,event);
  }
}

export async function listBookInstrumentPrices(client: DbClient, bookId: string, targetDate: string) {
  const result = await client.query(
    `SELECT i.id AS "instrumentId",$2::date::text AS "priceDate",
       COALESCE(mp.close,manual.price,0)::text AS price,
       (mp.close IS NOT NULL OR manual.price IS NOT NULL) AS available,
       CASE WHEN mp.close IS NOT NULL THEN mp.source WHEN manual.price IS NOT NULL THEN 'MANUAL' ELSE 'MISSING' END AS source
     FROM investment_instruments i
     LEFT JOIN market_daily_prices mp ON mp.market_symbol_id=i.market_symbol_id AND mp.price_date=$2::date
     LEFT JOIN LATERAL (
       SELECT price FROM investment_prices
       WHERE instrument_id=i.id AND (priced_at AT TIME ZONE 'Europe/Istanbul')::date=$2::date
       ORDER BY priced_at DESC LIMIT 1
     ) manual ON true
     WHERE i.book_id=$1 AND i.deleted_at IS NULL ORDER BY i.name`,
    [bookId,targetDate],
  );
  return { items: result.rows };
}
