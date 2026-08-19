import { z } from "zod";

export const uuid = z.string().uuid();
export const currency = z.string().regex(/^[A-Z]{3}$/);
export const money = z.string().regex(/^(0|[1-9]\d{0,13})(\.\d{1,6})?$/).refine((value) => value !== "0" && !/^0\.0*$/.test(value), "Amount must be positive");
export const nonnegativeMoney = z.string().regex(/^(0|[1-9]\d{0,13})(\.\d{1,6})?$/);
// Share counts, unlike money amounts, need room for fractional-share trading
// (US brokers commonly allow up to 9 decimal places) - matches the
// investment_lots/investment_sales quantity columns' NUMERIC(24,9).
export const quantity = z.string().regex(/^(0|[1-9]\d{0,14})(\.\d{1,9})?$/).refine((value) => value !== "0" && !/^0\.0*$/.test(value), "Quantity must be positive");
export const isoDate = z.string().datetime({ offset: true });
export const version = z.number().int().positive();
