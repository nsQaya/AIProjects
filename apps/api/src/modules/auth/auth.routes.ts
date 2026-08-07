import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { database } from "../../infrastructure/database";
import { parseJson } from "../../common/validation";
import { criticalRateLimit } from "../../middleware/rate-limit";
import { loginSchema, refreshSchema, registerSchema } from "./auth.schemas";
import { login, register, revokeRefreshToken, rotateRefreshToken } from "./auth.service";

export const authRoutes = new Hono<AppEnv>();
authRoutes.use("*", criticalRateLimit);
authRoutes.post("/register", async (c) => c.json(await register(c.get("database"), c.env, await parseJson(c.req.raw, registerSchema)), 201));
authRoutes.post("/login", async (c) => c.json(await login(c.get("database"), c.env, await parseJson(c.req.raw, loginSchema))));
authRoutes.post("/refresh", async (c) => c.json(await rotateRefreshToken(c.get("database"), c.env, (await parseJson(c.req.raw, refreshSchema)).refreshToken)));
authRoutes.post("/logout", async (c) => { await revokeRefreshToken(c.get("database"), c.env, (await parseJson(c.req.raw, refreshSchema)).refreshToken); return c.body(null, 204); });

