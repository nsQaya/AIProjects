import { z } from "zod";

export const uuid = z.string().uuid();
export const currency = z.string().regex(/^[A-Z]{3}$/);
export const money = z.string().regex(/^(0|[1-9]\d{0,13})(\.\d{1,6})?$/).refine((value) => value !== "0" && !/^0\.0*$/.test(value), "Amount must be positive");
export const nonnegativeMoney = z.string().regex(/^(0|[1-9]\d{0,13})(\.\d{1,6})?$/);
export const isoDate = z.string().datetime({ offset: true });
export const version = z.number().int().positive();
