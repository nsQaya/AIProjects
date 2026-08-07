import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { AppError } from "../../common/errors";
import { parseJson } from "../../common/validation";
import { requireBookRole } from "../../middleware/book-access";
import { createScheduledSchema, realizeScheduledSchema, scheduledStatusSchema, updateScheduledSchema } from "./scheduled.schemas";
import { createScheduled, deleteScheduled, listScheduled, realizeScheduled, scheduledBookId, setScheduledStatus, updateScheduled } from "./scheduled.service";

export const scheduledRoutes = new Hono<AppEnv>();

scheduledRoutes.get("/", async (c) => {
  const client = c.get("database");
  const bookId = c.req.query("bookId") ?? "";
  await requireBookRole(client,bookId,c.get("user").id,"VIEWER");
  return c.json(await listScheduled(client,bookId,c.req.query("view")==="all"));
});

scheduledRoutes.post("/", async (c) => {
  const input = await parseJson(c.req.raw,createScheduledSchema);
  const client = c.get("database");
  await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");
  return c.json(await createScheduled(client,c.get("user").id,input),201);
});

scheduledRoutes.patch("/:id/status", async (c) => {
  const client = c.get("database");
  const id = c.req.param("id");
  const input = await parseJson(c.req.raw,scheduledStatusSchema);
  await requireBookRole(client,await scheduledBookId(client,id),c.get("user").id,"EDITOR");
  return c.json(await setScheduledStatus(client,c.get("user").id,id,input.status,input.version));
});

scheduledRoutes.post("/:id/realize", async (c) => {
  const client = c.get("database");
  const id = c.req.param("id");
  const input = await parseJson(c.req.raw,realizeScheduledSchema);
  await requireBookRole(client,await scheduledBookId(client,id),c.get("user").id,"EDITOR");
  return c.json(await realizeScheduled(client,c.get("user").id,id,input));
});

scheduledRoutes.patch("/:id", async (c) => {
  const client = c.get("database");
  const id = c.req.param("id");
  await requireBookRole(client,await scheduledBookId(client,id),c.get("user").id,"EDITOR");
  return c.json(await updateScheduled(client,c.get("user").id,id,await parseJson(c.req.raw,updateScheduledSchema)));
});

scheduledRoutes.delete("/:id", async (c) => {
  const client = c.get("database");
  const id = c.req.param("id");
  const version = Number(c.req.query("version"));
  if (!Number.isInteger(version) || version < 1) throw new AppError(422,"INVALID_VERSION","A positive version is required");
  await requireBookRole(client,await scheduledBookId(client,id),c.get("user").id,"EDITOR");
  return c.json(await deleteScheduled(client,c.get("user").id,id,version));
});
