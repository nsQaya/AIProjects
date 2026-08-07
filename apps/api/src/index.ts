import { app } from "./app";
import type { BackgroundJob, Env } from "./config/bindings";
import { withDatabase } from "./infrastructure/database";
import { processDueRecurring } from "./modules/recurring-transactions/recurring.service";

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(env.JOBS.send({ type: "PROCESS_RECURRING" }));
  },
  async queue(batch: MessageBatch<BackgroundJob>, env: Env) {
    await withDatabase(env, async (client) => {
      for (const message of batch.messages) {
        try {
          if (message.body.type === "PROCESS_RECURRING") await processDueRecurring(client, message.body.recurringId);
          message.ack();
        } catch {
          message.retry();
        }
      }
    });
  },
} satisfies ExportedHandler<Env, BackgroundJob>;
