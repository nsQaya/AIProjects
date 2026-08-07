import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../config/bindings";
import { AppError } from "../common/errors";

export const criticalRateLimit = createMiddleware<AppEnv>(async (c, next) => {
  const ip = c.req.header("CF-Connecting-IP") ?? "unknown";
  let result: { success: boolean };
  try {
    result = await c.env.RATE_LIMITER.limit({ key: `${ip}:${c.req.path}` });
  } catch (error) {
    const name = error instanceof Error ? error.name : "UnknownError";
    console.error(JSON.stringify({ event: "RATE_LIMITER_DIAGNOSTIC", name }));
    throw new AppError(500, "SECURITY_SERVICE_UNAVAILABLE", "Authentication security service is temporarily unavailable");
  }
  if (!result.success) throw new AppError(429, "RATE_LIMITED", "Too many requests");
  await next();
});
