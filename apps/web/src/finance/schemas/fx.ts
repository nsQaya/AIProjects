import { z } from "zod";
import {
  currencyCodeSchema,
  decimalStringSchema,
  isoDateTimeSchema,
  uuidSchema,
} from "./primitives";

export const fxConversionSchema = z.object({
  id: uuidSchema,
  transactionNo: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  transactionDate: isoDateTimeSchema,
  currencyCode: currencyCodeSchema,
  fromAccountId: uuidSchema,
  fromAccountName: z.string(),
  fromAmount: decimalStringSchema,
  fromCurrency: currencyCodeSchema,
  toAccountId: uuidSchema,
  toAccountName: z.string(),
  toAmount: decimalStringSchema,
  toCurrency: currencyCodeSchema,
  tryAmount: decimalStringSchema,
});
