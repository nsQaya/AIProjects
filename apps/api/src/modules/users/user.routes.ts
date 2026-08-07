import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { database } from "../../infrastructure/database";
import { AppError } from "../../common/errors";

export const userRoutes = new Hono<AppEnv>();
userRoutes.get("/", async (c) => {
  const result = await c.get("database").query(
    `SELECT id,email,display_name AS "displayName",status,created_at AS "createdAt",version FROM users WHERE id=$1 AND deleted_at IS NULL`,
    [c.get("user").id],
  );
  if (!result.rows[0]) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  return c.json(result.rows[0]);
});

