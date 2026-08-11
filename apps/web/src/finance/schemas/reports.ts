import { z } from "zod";
import {
  accountTypeSchema,
  categoryTypeSchema,
  clientTransactionTypeSchema,
  scheduledTransactionTypeSchema,
} from "./core";
import {
  currencyCodeSchema,
  decimalStringSchema,
  isoDateTimeSchema,
  itemListSchema,
  uuidSchema,
} from "./primitives";

export const dashboardReportSchema = z.object({
  month: z.object({
    income: decimalStringSchema,
    expense: decimalStringSchema,
  }),
  importantAccounts: z.array(
    z.object({
      id: uuidSchema,
      name: z.string(),
      accountType: accountTypeSchema,
      currencyCode: currencyCodeSchema,
      creditLimit: decimalStringSchema.nullable(),
      balance: decimalStringSchema,
    }),
  ),
  recentTransactions: z.array(
    z.object({
      id: uuidSchema,
      type: clientTransactionTypeSchema,
      title: z.string(),
      transactionDate: isoDateTimeSchema,
      currencyCode: currencyCodeSchema,
      amount: decimalStringSchema,
    }),
  ),
  upcoming: z.array(
    z.object({
      id: uuidSchema,
      title: z.string(),
      amount: decimalStringSchema,
      currencyCode: currencyCodeSchema,
      scheduledAt: isoDateTimeSchema,
      type: scheduledTransactionTypeSchema,
    }),
  ),
});

export const cashFlowGranularitySchema = z.enum(["day", "week", "month", "year"]);

export const cashFlowItemSchema = z.object({
  period: z.string(),
  month: z.string(),
  periodStart: isoDateTimeSchema,
  income: decimalStringSchema,
  expense: decimalStringSchema,
  net: decimalStringSchema,
  balance: decimalStringSchema,
});

export const cashFlowResponseSchema = z.object({
  items: z.array(cashFlowItemSchema),
  granularity: cashFlowGranularitySchema,
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
});

export const incomeExpenseReportItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  type: categoryTypeSchema,
  isActive: z.boolean(),
  amount: decimalStringSchema,
});

export const incomeExpenseReportSchema = z.object({
  items: z.array(incomeExpenseReportItemSchema),
  costCenters: z.array(
    z.object({
      id: uuidSchema,
      name: z.string(),
      isActive: z.boolean(),
      amount: decimalStringSchema,
    }),
  ),
});

export const balanceReportItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  accountType: accountTypeSchema,
  currencyCode: currencyCodeSchema,
  balance: decimalStringSchema,
});

export const balanceReportSchema = itemListSchema(balanceReportItemSchema);

export const receivablePayableReportItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  contactType: z.enum(["CUSTOMER", "SUPPLIER", "PERSON", "EMPLOYEE", "OTHER"]),
  currencyCode: currencyCodeSchema,
  balance: decimalStringSchema,
});

export const receivablePayableReportSchema = itemListSchema(receivablePayableReportItemSchema);
