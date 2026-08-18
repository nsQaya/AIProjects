import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../config/bindings";
import { AppError } from "../../common/errors";
import { parseJson } from "../../common/validation";
import { requireBookRole } from "../../middleware/book-access";
import {
  createCurrencySyncRun,disableCurrency,enableCurrency,latestCurrencySyncRun,
  listBookCurrencyRates,listCurrencies,
} from "./currency.service";

export const currencyRoutes = new Hono<AppEnv>();

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
const bookScopedSchema = z.object({ bookId: z.string().uuid() });
const rateSyncSchema = z.object({ bookId: z.string().uuid(), date: calendarDate });

async function queryContext(c: any, role: "VIEWER" | "EDITOR" = "VIEWER") {
  const client = c.get("database"), bookId = c.req.query("bookId") ?? "";
  await requireBookRole(client, bookId, c.get("user").id, role);
  return { client, bookId };
}

currencyRoutes.get("/", async (c) => {
  const { client, bookId } = await queryContext(c);
  return c.json(await listCurrencies(client, bookId));
});
currencyRoutes.post("/:code/enable", async (c) => {
  const input = await parseJson(c.req.raw, bookScopedSchema), client = c.get("database");
  await requireBookRole(client, input.bookId, c.get("user").id, "EDITOR");
  return c.json(await enableCurrency(client, input.bookId, c.req.param("code").toUpperCase()), 201);
});
currencyRoutes.delete("/:code/enable", async (c) => {
  const input = bookScopedSchema.parse({ bookId: c.req.query("bookId") }), client = c.get("database");
  await requireBookRole(client, input.bookId, c.get("user").id, "EDITOR");
  return c.json(await disableCurrency(client, input.bookId, c.req.param("code").toUpperCase()));
});
currencyRoutes.get("/rates/by-date", async (c) => {
  const { client, bookId } = await queryContext(c), parsed = calendarDate.safeParse(c.req.query("date"));
  if (!parsed.success) throw new AppError(422, "INVALID_DATE", "A valid rate date is required");
  return c.json(await listBookCurrencyRates(client, bookId, parsed.data));
});
currencyRoutes.get("/rates/sync-status", async (c) => {
  const { client } = await queryContext(c), parsed = calendarDate.safeParse(c.req.query("date"));
  if (!parsed.success) throw new AppError(422, "INVALID_DATE", "A valid rate date is required");
  return c.json({ run: await latestCurrencySyncRun(client, parsed.data) });
});
currencyRoutes.post("/rates/sync", async (c) => {
  const input = await parseJson(c.req.raw, rateSyncSchema), client = c.get("database"), userId = c.get("user").id;
  await requireBookRole(client, input.bookId, userId, "EDITOR");
  const run = await createCurrencySyncRun(client, input.date, "MANUAL", userId);
  await c.env.JOBS.send({ type: "SYNC_CURRENCY_RATES", targetDate: input.date });
  return c.json(run, 202);
});
