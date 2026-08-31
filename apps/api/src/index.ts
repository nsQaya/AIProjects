import { app } from "./app";
import type { BackgroundJob, Env } from "./config/bindings";
import { withDatabase } from "./infrastructure/database";
import { processDueRecurring } from "./modules/recurring-transactions/recurring.service";
import {
  createPriceSyncRun,ensureMarketData,planPriceSync,processFundPriceBatch,processPriceBatch,processSplitBatch,queueLinkedSplitBatches,syncMarketCatalog,
} from "./modules/market-data/market-data.service";
import { syncCurrencyRates } from "./modules/currency/currency.service";

export default {
  fetch: app.fetch,
  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    if (controller.cron === "*/15 * * * *") {
      const targetDate = new Date(controller.scheduledTime).toISOString().slice(0,10);
      ctx.waitUntil(Promise.all([
        env.JOBS.send({ type: "PROCESS_RECURRING" }),
        env.JOBS.send({ type: "ENSURE_MARKET_DATA",targetDate }),
      ]));
    }
    if (controller.cron === "5 3 * * 1") {
      ctx.waitUntil(env.JOBS.send({ type: "SYNC_MARKET_CATALOG" }));
    }
    if (controller.cron === "30 22 * * 2-6") {
      const targetDate = new Date(controller.scheduledTime).toISOString().slice(0,10);
      ctx.waitUntil(withDatabase(env,async client=>{
        const run=await createPriceSyncRun(client,targetDate,"SCHEDULED");
        await Promise.all([
          env.JOBS.send({type:"PLAN_MARKET_PRICES",runId:run.id,targetDate}),
          env.JOBS.send({type:"PLAN_MARKET_SPLITS"}),
        ]);
      }));
    }
    if (controller.cron === "0 13 * * 2-6") {
      const targetDate = new Date(controller.scheduledTime).toISOString().slice(0,10);
      ctx.waitUntil(env.JOBS.send({ type: "SYNC_CURRENCY_RATES",targetDate }));
    }
    // Hourly while BIST/US are open (07:00-21:00 UTC, Mon-Fri): pull the current
    // intraday quote for every tracked code and stamp it on today unconditionally.
    if (controller.cron === "0 7-21 * * 1-5") {
      const targetDate = new Date(controller.scheduledTime).toISOString().slice(0,10);
      ctx.waitUntil(withDatabase(env,async client=>{
        const run=await createPriceSyncRun(client,targetDate,"SCHEDULED");
        await env.JOBS.send({type:"PLAN_MARKET_PRICES",runId:run.id,targetDate,mode:"LIVE"});
      }));
    }
  },
  async queue(batch: MessageBatch<BackgroundJob>, env: Env) {
    await withDatabase(env, async (client) => {
      for (const message of batch.messages) {
        try {
          const job=message.body;
          if (job.type === "PROCESS_RECURRING") await processDueRecurring(client, job.recurringId);
          else if(job.type === "ENSURE_MARKET_DATA") await ensureMarketData(client,env.JOBS,job.targetDate);
          else if(job.type === "SYNC_MARKET_CATALOG") await syncMarketCatalog(client);
          else if(job.type === "PLAN_MARKET_PRICES") await planPriceSync(client,env.JOBS,job.runId,job.targetDate,job.mode ?? "CLOSE");
          else if(job.type === "FETCH_MARKET_PRICE_BATCH") await processPriceBatch(client,job);
          else if(job.type === "FETCH_FUND_PRICE_BATCH") await processFundPriceBatch(client,job);
          else if(job.type === "PLAN_MARKET_SPLITS") await queueLinkedSplitBatches(client,env.JOBS);
          else if(job.type === "FETCH_MARKET_SPLIT_BATCH") await processSplitBatch(client,job.items);
          else if(job.type === "SYNC_CURRENCY_RATES") await syncCurrencyRates(client,job.targetDate);
          message.ack();
        } catch {
          message.retry();
        }
      }
    });
  },
} satisfies ExportedHandler<Env, BackgroundJob>;
