import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../config/bindings";

export const requestContext = createMiddleware<AppEnv>(async (c, next) => {
  const supplied = c.req.header("X-Request-Id");
  c.set("requestId", supplied?.slice(0, 100) || crypto.randomUUID());
  c.header("X-Request-Id", c.get("requestId"));
  c.header("X-Content-Type-Options", "nosniff");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Cache-Control", "no-store");
  await next();
});

