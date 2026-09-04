import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { AppError } from "../../common/errors";
import { parseJson } from "../../common/validation";
import { assertAccountAccess } from "../../middleware/account-access";
import { requireBookRole } from "../../middleware/book-access";
import type { DbClient } from "../../infrastructure/database";
import { createAccountSchema, updateAccountSchema } from "./account.schemas";
import { createAccount, deleteOrArchiveAccount, getAccountBalance, listAccounts, updateAccount } from "./account.service";
import { shareAccountSchema, updateAccountShareSchema } from "./account-share.schemas";
import {
  accountPostingContext,
  listAccountShares,
  listSharedWithMe,
  revokeAccountShare,
  shareAccount,
  updateAccountShare,
} from "./account-share.service";

export const accountRoutes = new Hono<AppEnv>();

accountRoutes.get("/", async (c) => {
  const client = c.get("database");
  const bookId = c.req.query("bookId") ?? "";
  await requireBookRole(client, bookId, c.get("user").id, "VIEWER");
  return c.json(await listAccounts(client, bookId, c.req.query("includeArchived") === "true"));
});

// Static route: accounts other users have shared with the caller.
accountRoutes.get("/shared-with-me", async (c) => {
  const client = c.get("database");
  return c.json(await listSharedWithMe(client, c.get("user").id));
});

accountRoutes.post("/", async (c) => {
  const input = await parseJson(c.req.raw, createAccountSchema);
  const client = c.get("database");
  await requireBookRole(client, input.bookId, c.get("user").id, "EDITOR");
  return c.json(await createAccount(client, c.get("user").id, input), 201);
});

accountRoutes.patch("/:accountId", async (c) => {
  const client = c.get("database");
  const accountId = c.req.param("accountId");
  const bookId = await accountBookId(client, accountId);
  await requireBookRole(client, bookId, c.get("user").id, "EDITOR");
  return c.json(await updateAccount(client, c.get("user").id, accountId, await parseJson(c.req.raw, updateAccountSchema)));
});

accountRoutes.get("/:accountId/balance", async (c) => {
  const client = c.get("database");
  const accountId = c.req.param("accountId");
  await assertAccountAccess(client, accountId, c.get("user").id, "VIEW");
  return c.json(await getAccountBalance(client, accountId));
});

accountRoutes.delete("/:accountId", async (c) => {
  const client = c.get("database");
  const accountId = c.req.param("accountId");
  const version = Number(c.req.query("version"));
  if (!Number.isInteger(version) || version < 1) throw new AppError(422, "INVALID_VERSION", "A positive version is required");
  const bookId = await accountBookId(client, accountId);
  await requireBookRole(client, bookId, c.get("user").id, "ADMIN");
  return c.json(await deleteOrArchiveAccount(client, c.get("user").id, accountId, version));
});

// --- Account sharing ---

accountRoutes.get("/:accountId/shares", async (c) => {
  const client = c.get("database");
  const accountId = c.req.param("accountId");
  await assertAccountAccess(client, accountId, c.get("user").id, "MANAGE");
  return c.json(await listAccountShares(client, accountId));
});

accountRoutes.post("/:accountId/shares", async (c) => {
  const client = c.get("database");
  const accountId = c.req.param("accountId");
  const input = await parseJson(c.req.raw, shareAccountSchema);
  return c.json(await shareAccount(client, c.get("user").id, accountId, input), 201);
});

accountRoutes.patch("/:accountId/shares/:shareId", async (c) => {
  const client = c.get("database");
  const input = await parseJson(c.req.raw, updateAccountShareSchema);
  return c.json(
    await updateAccountShare(client, c.get("user").id, c.req.param("accountId"), c.req.param("shareId"), input),
  );
});

accountRoutes.delete("/:accountId/shares/:shareId", async (c) => {
  const client = c.get("database");
  return c.json(
    await revokeAccountShare(client, c.get("user").id, c.req.param("accountId"), c.req.param("shareId")),
  );
});

accountRoutes.get("/:accountId/posting-context", async (c) => {
  const client = c.get("database");
  return c.json(await accountPostingContext(client, c.get("user").id, c.req.param("accountId")));
});

async function accountBookId(client: DbClient, accountId: string) {
  const result = await client.query<{ book_id: string }>(
    `SELECT book_id FROM accounts WHERE id=$1 AND deleted_at IS NULL AND is_system=false`,
    [accountId],
  );
  if (!result.rows[0]) throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account was not found");
  return result.rows[0].book_id;
}
