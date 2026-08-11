import { z } from "zod";

const apiErrorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    details: z.unknown().optional(),
    requestId: z.string().optional(),
  }),
});

export interface APIErrorOptions {
  details?: unknown;
  requestId?: string;
  cause?: unknown;
}

export class APIError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    options: APIErrorOptions = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "APIError";
    this.status = status;
    this.code = code;
    this.details = options.details ?? null;
    this.requestId = options.requestId;
  }
}

export function apiErrorFromResponse(status: number, value: unknown): APIError {
  const parsed = apiErrorEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    return new APIError(status, `HTTP_${status}`, "İstek tamamlanamadı");
  }

  return new APIError(status, parsed.data.error.code, parsed.data.error.message, {
    details: parsed.data.error.details,
    requestId: parsed.data.error.requestId,
  });
}

export function isAPIError(error: unknown): error is APIError {
  return error instanceof APIError;
}
