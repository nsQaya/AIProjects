import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { AppError } from "../../common/errors";
import { parseJson } from "../../common/validation";
import { criticalRateLimit } from "../../middleware/rate-limit";
import { changePassword } from "../auth/auth.service";
import { changePasswordSchema, completePageTourSchema } from "./user.schemas";

export const userRoutes = new Hono<AppEnv>();
userRoutes.get("/", async (c) => {
  const result = await c.get("database").query(
    `SELECT id,email,display_name AS "displayName",status,created_at AS "createdAt",version,
            onboarding_completed_at AS "onboardingCompletedAt",onboarding_pages_completed AS "onboardingPagesCompleted"
     FROM users WHERE id=$1 AND deleted_at IS NULL`,
    [c.get("user").id],
  );
  if (!result.rows[0]) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  return c.json(result.rows[0]);
});
userRoutes.patch("/password", criticalRateLimit, async (c) => c.json(await changePassword(
  c.get("database"),
  c.env,
  c.get("user").id,
  await parseJson(c.req.raw, changePasswordSchema),
)));
userRoutes.patch("/onboarding", async (c) => {
  const result = await c.get("database").query<{ onboardingCompletedAt: Date }>(
    `UPDATE users SET onboarding_completed_at=COALESCE(onboarding_completed_at,now()) WHERE id=$1 AND deleted_at IS NULL RETURNING onboarding_completed_at AS "onboardingCompletedAt"`,
    [c.get("user").id],
  );
  if (!result.rows[0]) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  return c.json(result.rows[0]);
});
userRoutes.patch("/onboarding/pages", async (c) => {
  const { page } = await parseJson(c.req.raw, completePageTourSchema);
  const result = await c.get("database").query<{ onboardingPagesCompleted: string[] }>(
    `UPDATE users SET onboarding_pages_completed =
       CASE WHEN $2 = ANY(onboarding_pages_completed) THEN onboarding_pages_completed
            ELSE array_append(onboarding_pages_completed,$2) END
     WHERE id=$1 AND deleted_at IS NULL
     RETURNING onboarding_pages_completed AS "onboardingPagesCompleted"`,
    [c.get("user").id, page],
  );
  if (!result.rows[0]) throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  return c.json(result.rows[0]);
});
