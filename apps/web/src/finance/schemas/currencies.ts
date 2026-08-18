import { z } from "zod";
import {
  currencyCodeSchema,
  decimalStringSchema,
  isoDateTimeSchema,
  itemListSchema,
  uuidSchema,
} from "./primitives";

export const currencySchema = z.object({
  code: currencyCodeSchema,
  nameTr: z.string(),
  nameEn: z.string(),
  isEnabled: z.boolean(),
});

export const currencyListSchema = itemListSchema(currencySchema);

export const enableCurrencyResponseSchema = z.object({ code: currencyCodeSchema, isEnabled: z.literal(true) });
export const disableCurrencyResponseSchema = z.object({ code: currencyCodeSchema, isEnabled: z.literal(false) });

export const currencyRateAtDateSchema = z.object({
  currencyCode: currencyCodeSchema,
  rateDate: z.string(),
  tryRate: decimalStringSchema,
  available: z.boolean(),
  source: z.enum(["TCMB", "MISSING"]),
});

export const currencyRatesAtDateSchema = itemListSchema(currencyRateAtDateSchema);

export const currencyRateSyncRunSchema = z.object({
  id: uuidSchema,
  kind: z.literal("CURRENCY_RATES"),
  targetDate: z.string(),
  status: z.enum(["QUEUED", "RUNNING", "COMPLETED", "FAILED"]),
  totalItems: z.number().int(),
  processedItems: z.number().int(),
  updatedItems: z.number().int(),
  missingItems: z.number().int(),
  failedItems: z.number().int(),
  startedAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const currencyRateSyncStatusSchema = z.object({ run: currencyRateSyncRunSchema.nullable() });
