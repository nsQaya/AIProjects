import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { database } from "../../infrastructure/database";
import { parseJson } from "../../common/validation";
import { criticalRateLimit } from "../../middleware/rate-limit";
import { forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema } from "./auth.schemas";
import { login, register, requestPasswordReset, resetPassword, revokeRefreshToken, rotateRefreshToken } from "./auth.service";
import { createPasswordResetMailer } from "./password-reset-mailer";

export const authRoutes = new Hono<AppEnv>();
authRoutes.use("*", criticalRateLimit);
authRoutes.post("/register", async (c) => c.json(await register(c.get("database"), c.env, await parseJson(c.req.raw, registerSchema)), 201));
authRoutes.post("/login", async (c) => c.json(await login(c.get("database"), c.env, await parseJson(c.req.raw, loginSchema))));
authRoutes.post("/refresh", async (c) => c.json(await rotateRefreshToken(c.get("database"), c.env, (await parseJson(c.req.raw, refreshSchema)).refreshToken)));
authRoutes.post("/logout", async (c) => { await revokeRefreshToken(c.get("database"), c.env, (await parseJson(c.req.raw, refreshSchema)).refreshToken); return c.body(null, 204); });
authRoutes.post("/forgot-password", async (c) => {
  await requestPasswordReset(
    c.get("database"),
    c.env,
    await parseJson(c.req.raw, forgotPasswordSchema),
    createPasswordResetMailer(c.env),
  );
  return c.json({ accepted: true as const }, 202);
});
authRoutes.post("/reset-password", async (c) => {
  await resetPassword(c.get("database"), c.env, await parseJson(c.req.raw, resetPasswordSchema));
  return c.body(null, 204);
});
