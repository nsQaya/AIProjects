import { z } from "zod";

export const uuidSchema = z.string().uuid();
export const currencyCodeSchema = z.string().trim().length(3);
export const versionSchema = z.number().int().positive();

/**
 * PostgreSQL numeric values deliberately stay as strings at the HTTP boundary.
 * This accepts ordinary (non-exponential) decimal serialization without applying
 * JavaScript floating-point arithmetic to ledger values.
 */
export const decimalStringSchema = z
  .string()
  .regex(/^-?\d+(?:\.\d+)?$/, "Expected a decimal string");

export const isoDateTimeSchema = z.string().min(1).refine(
  (value) => Number.isFinite(Date.parse(value)),
  "Expected an ISO-compatible date",
);

export const deletedEntitySchema = z.object({
  id: uuidSchema,
  deleted: z.literal(true),
  version: versionSchema,
});

export const deactivatedEntitySchema = z.object({
  id: uuidSchema,
  isActive: z.literal(false),
  version: versionSchema,
});

export function itemListSchema<TSchema extends z.ZodType>(item: TSchema) {
  return z.object({ items: z.array(item) });
}
