import type { Context } from "hono";
import type { AppEnv } from "../config/bindings";

export class AppError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 503,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) { super(message); }
}

export function errorResponse(error: unknown, c: Context<AppEnv>) {
  if (error instanceof AppError) {
    return c.json({ error: { code: error.code, message: error.message, details: error.details, requestId: c.get("requestId") } }, error.status);
  }
  // Never log request bodies, credentials, tokens, or financial payloads.
  console.error(JSON.stringify({ level: "error", requestId: c.get("requestId"), message: error instanceof Error ? error.message : "Unknown error" }));
  return c.json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error", requestId: c.get("requestId") } }, 500);
}
