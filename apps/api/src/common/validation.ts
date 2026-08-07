import type { ZodType } from "zod";
import { AppError } from "./errors";

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 64 * 1024) throw new AppError(422, "PAYLOAD_TOO_LARGE", "Request body exceeds 64 KiB");
  let value: unknown;
  try { value = await request.json(); } catch { throw new AppError(422, "INVALID_JSON", "Request body must be valid JSON"); }
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError(422, "VALIDATION_ERROR", "Request validation failed", result.error.flatten());
  return result.data;
}

