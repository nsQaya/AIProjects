import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { AppError } from "../../common/errors";
import { parseJson } from "../../common/validation";
import { requireBookRole } from "../../middleware/book-access";
import { createAccountTypeSchema, updateAccountTypeSchema } from "./account-type.schemas";
import {
  accountTypeBookId,
  createAccountType,
  deleteOrDeactivateAccountType,
  listAccountTypes,
  updateAccountType,
} from "./account-type.service";

export const accountTypeRoutes = new Hono<AppEnv>();

accountTypeRoutes.get("/", async (c) => {
  const client = c.get("database");
  const bookId = c.req.query("bookId") ?? "";
  await requireBookRole(client, bookId, c.get("user").id, "VIEWER");
  return c.json(await listAccountTypes(client, bookId, c.req.query("includeInactive") === "true"));
});

accountTypeRoutes.post("/", async (c) => {
  const input = await parseJson(c.req.raw, createAccountTypeSchema);
  const client = c.get("database");
  await requireBookRole(client, input.bookId, c.get("user").id, "EDITOR");
  return c.json(await createAccountType(client, c.get("user").id, input), 201);
});

accountTypeRoutes.patch("/:id", async (c) => {
  const client = c.get("database");
  const id = c.req.param("id");
  const bookId = await accountTypeBookId(client, id);
  await requireBookRole(client, bookId, c.get("user").id, "EDITOR");
  return c.json(await updateAccountType(client, c.get("user").id, id, await parseJson(c.req.raw, updateAccountTypeSchema)));
});

accountTypeRoutes.delete("/:id", async (c) => {
  const client = c.get("database");
  const id = c.req.param("id");
  const version = Number(c.req.query("version"));
  if (!Number.isInteger(version) || version < 1) throw new AppError(422, "INVALID_VERSION", "A positive version is required");
  const bookId = await accountTypeBookId(client, id);
  await requireBookRole(client, bookId, c.get("user").id, "EDITOR");
  return c.json(await deleteOrDeactivateAccountType(client, c.get("user").id, id, version));
});
