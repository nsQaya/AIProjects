import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { parseJson } from "../../common/validation";
import { requireBookRole } from "../../middleware/book-access";
import { createFxConversionSchema } from "./fx.schemas";
import { createFxConversion } from "./fx.service";

export const fxRoutes = new Hono<AppEnv>();

fxRoutes.post("/conversions", async (c) => {
  const input = await parseJson(c.req.raw, createFxConversionSchema);
  const client = c.get("database");
  await requireBookRole(client, input.bookId, c.get("user").id, "EDITOR");
  return c.json(await createFxConversion(client, c.get("user").id, input), 201);
});
