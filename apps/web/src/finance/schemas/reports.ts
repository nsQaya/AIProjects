import { z } from "zod";
import {
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
      accountTypeId: uuidSchema,
      accountTypeName: z.string(),
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

const accountBalanceSeriesItemSchema = z.object({
  period: z.string(),
  periodStart: isoDateTimeSchema,
  accountId: uuidSchema,
  balance: decimalStringSchema,
});

const reportTransactionDetailSchema = z.object({
  id: uuidSchema,
  type: clientTransactionTypeSchema,
  title: z.string(),
  transactionDate: isoDateTimeSchema,
  categoryId: uuidSchema.nullable(),
  categoryName: z.string().nullable(),
  costCenterId: uuidSchema.nullable(),
  costCenterName: z.string().nullable(),
  accountName: z.string().nullable(),
  currencyCode: currencyCodeSchema,
  amount: decimalStringSchema,
});

export const reportAnalyticsSchema = z.object({
  from: isoDateTimeSchema,
  to: isoDateTimeSchema,
  granularity: cashFlowGranularitySchema,
  currencyCode: currencyCodeSchema,
  trend: z.array(cashFlowItemSchema),
  accountBalances: z.object({
    accounts: z.array(z.object({
      id: uuidSchema,
      name: z.string(),
      currencyCode: currencyCodeSchema,
    })),
    items: z.array(accountBalanceSeriesItemSchema),
  }),
  categoryDetail: z.object({
    breakdown: z.array(z.object({
      categoryId: uuidSchema,
      categoryName: z.string(),
      categoryType: categoryTypeSchema,
      costCenterId: uuidSchema.nullable(),
      costCenterName: z.string().nullable(),
      amount: decimalStringSchema,
    })),
    transactions: z.array(reportTransactionDetailSchema),
  }),
  liquidity: z.object({
    openingBalance: decimalStringSchema,
    items: z.array(z.object({
      period: z.string(),
      periodStart: isoDateTimeSchema,
      inflow: decimalStringSchema,
      outflow: decimalStringSchema,
      net: decimalStringSchema,
      projectedBalance: decimalStringSchema,
    })),
    events: z.array(z.object({
      id: uuidSchema,
      title: z.string(),
      scheduledAt: isoDateTimeSchema,
      type: scheduledTransactionTypeSchema,
      impact: decimalStringSchema,
    })),
  }),
  investmentValueSeries: z.array(z.object({
    period: z.string(),
    periodStart: isoDateTimeSchema,
    value: decimalStringSchema,
  })),
  netWorth: z.object({
    cashBalance: decimalStringSchema,
    investmentCost: decimalStringSchema,
    investmentValue: decimalStringSchema,
    realizedGain: decimalStringSchema,
    unrealizedGain: decimalStringSchema,
    totalAssets: decimalStringSchema,
    items: z.array(z.object({
      instrumentId: uuidSchema,
      name: z.string(),
      symbol: z.string().nullable(),
      assetTypeName: z.string(),
      currencyCode: currencyCodeSchema,
      quantity: decimalStringSchema,
      costBasis: decimalStringSchema,
      currentValue: decimalStringSchema.nullable(),
      realizedGain: decimalStringSchema,
      unrealizedGain: decimalStringSchema.nullable(),
      latestPriceAt: isoDateTimeSchema.nullable(),
      currentValueTRY: decimalStringSchema.nullable(),
      unrealizedGainTRY: decimalStringSchema.nullable(),
      costBasisTRY: decimalStringSchema.nullable(),
      realizedGainTRY: decimalStringSchema.nullable(),
    })),
  }),
});

export const balanceReportItemSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  accountTypeId: uuidSchema,
  accountTypeName: z.string(),
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
