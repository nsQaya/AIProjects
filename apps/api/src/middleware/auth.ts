import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../config/bindings";
import { AppError } from "../common/errors";
import { verifyAccessToken } from "../common/crypto";

export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
  const authorization = c.req.header("Authorization");
  if (!authorization?.startsWith("Bearer ")) throw new AppError(401, "AUTH_REQUIRED", "Authentication is required");
  try {
    const claims = await verifyAccessToken(authorization.slice(7), c.env.JWT_SECRET);
    c.set("user", { id: claims.sub, email: claims.email });
  } catch {
    throw new AppError(401, "INVALID_TOKEN", "Access token is invalid or expired");
  }
  await next();
});

