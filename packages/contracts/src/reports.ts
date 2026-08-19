import type { AccountType } from "./accounts.js";
import type { CategoryType } from "./categories.js";
import type { CurrencyCode, ISODateTimeString, MoneyString, UUID } from "./common.js";
import type { ScheduledTransactionType } from "./scheduled-transactions.js";
import type { ClientTransactionType } from "./transactions.js";

export type ReportAccountSelection = "all" | "none" | readonly UUID[];

export interface ReportRangeQuery {
  bookId: UUID;
  from?: ISODateTimeString;
  to?: ISODateTimeString;
  accountIds?: ReportAccountSelection;
}

export interface DashboardMonthSummaryDTO {
  income: MoneyString;
  expense: MoneyString;
}

export interface DashboardAccountDTO {
  id: UUID;
  name: string;
  accountType: AccountType;
  currencyCode: CurrencyCode;
  creditLimit: MoneyString | null;
  balance: MoneyString;
}

export interface DashboardRecentTransactionDTO {
  id: UUID;
  type: ClientTransactionType;
  title: string;
  transactionDate: ISODateTimeString;
  currencyCode: CurrencyCode;
  amount: MoneyString;
}

export interface DashboardUpcomingTransactionDTO {
  id: UUID;
  title: string;
  amount: MoneyString;
  currencyCode: CurrencyCode;
  scheduledAt: ISODateTimeString;
  type: ScheduledTransactionType;
}

export interface DashboardReportResponse {
  month: DashboardMonthSummaryDTO;
  importantAccounts: DashboardAccountDTO[];
  recentTransactions: DashboardRecentTransactionDTO[];
  upcoming: DashboardUpcomingTransactionDTO[];
}

export type CashFlowGranularity = "day" | "week" | "month" | "year";
export type ReportGranularity = CashFlowGranularity;

/**
 * Semantic account selection for GET /reports/cash-flow. Omission and "all" both
 * include every account; "none" includes no account balance; selected UUIDs are
 * serialized as a comma-separated query value.
 */
export type CashFlowAccountSelection = ReportAccountSelection;

export interface CashFlowQuery extends ReportRangeQuery {
  granularity?: CashFlowGranularity;
  accountIds?: CashFlowAccountSelection;
}

export interface CashFlowItemDTO {
  period: string;
  month: string;
  periodStart: ISODateTimeString;
  income: MoneyString;
  expense: MoneyString;
  net: MoneyString;
  /** Server-calculated end-of-period balance for the requested account scope. */
  balance: MoneyString;
}

export interface CashFlowResponse {
  items: CashFlowItemDTO[];
  granularity: CashFlowGranularity;
  from: ISODateTimeString;
  to: ISODateTimeString;
}

export interface IncomeExpenseReportItemDTO {
  id: UUID;
  name: string;
  type: CategoryType;
  /** Inactive categories remain in historical reporting when they have entries. */
  isActive: boolean;
  amount: MoneyString;
}

export interface IncomeExpenseCostCenterItemDTO {
  id: UUID;
  name: string;
  /** Inactive cost centers remain visible when they have historical transactions. */
  isActive: boolean;
  /** Signed net contribution: income is positive and expense is negative. */
  amount: MoneyString;
}

export interface IncomeExpenseReportResponse {
  items: IncomeExpenseReportItemDTO[];
  costCenters: IncomeExpenseCostCenterItemDTO[];
}

export interface AccountBalanceSeriesAccountDTO {
  id: UUID;
  name: string;
  currencyCode: CurrencyCode;
}

export interface AccountBalanceSeriesItemDTO {
  period: string;
  periodStart: ISODateTimeString;
  accountId: UUID;
  balance: MoneyString;
}

export interface CategoryCostCenterBreakdownDTO {
  categoryId: UUID;
  categoryName: string;
  categoryType: CategoryType;
  costCenterId: UUID | null;
  costCenterName: string | null;
  amount: MoneyString;
}

export interface ReportTransactionDetailDTO {
  id: UUID;
  type: ClientTransactionType;
  title: string;
  transactionDate: ISODateTimeString;
  categoryId: UUID | null;
  categoryName: string | null;
  costCenterId: UUID | null;
  costCenterName: string | null;
  accountName: string | null;
  currencyCode: CurrencyCode;
  amount: MoneyString;
}

export interface LiquidityForecastItemDTO {
  period: string;
  periodStart: ISODateTimeString;
  inflow: MoneyString;
  outflow: MoneyString;
  net: MoneyString;
  projectedBalance: MoneyString;
}

export interface LiquidityForecastEventDTO {
  id: UUID;
  title: string;
  scheduledAt: ISODateTimeString;
  type: ScheduledTransactionType;
  impact: MoneyString;
}

export interface InvestmentPerformanceItemDTO {
  instrumentId: UUID;
  name: string;
  symbol: string | null;
  assetTypeName: string;
  currencyCode: CurrencyCode;
  quantity: MoneyString;
  costBasis: MoneyString;
  currentValue: MoneyString | null;
  realizedGain: MoneyString;
  unrealizedGain: MoneyString | null;
  latestPriceAt: ISODateTimeString | null;
  /** currentValue/unrealizedGain converted to TRY at the latest known TCMB rate; equal to the plain fields when currencyCode is TRY, null when a foreign-currency instrument has no rate yet. */
  currentValueTRY: MoneyString | null;
  unrealizedGainTRY: MoneyString | null;
  /** costBasis/realizedGain converted to TRY at the latest known TCMB rate; equal to the plain fields when currencyCode is TRY, null when a foreign-currency instrument has no rate yet. */
  costBasisTRY: MoneyString | null;
  realizedGainTRY: MoneyString | null;
}

export interface InvestmentValueSeriesItemDTO {
  period: string;
  periodStart: ISODateTimeString;
  value: MoneyString;
}

export interface ReportAnalyticsResponse {
  from: ISODateTimeString;
  to: ISODateTimeString;
  granularity: ReportGranularity;
  currencyCode: CurrencyCode;
  trend: CashFlowItemDTO[];
  accountBalances: {
    accounts: AccountBalanceSeriesAccountDTO[];
    items: AccountBalanceSeriesItemDTO[];
  };
  categoryDetail: {
    breakdown: CategoryCostCenterBreakdownDTO[];
    transactions: ReportTransactionDetailDTO[];
  };
  liquidity: {
    openingBalance: MoneyString;
    items: LiquidityForecastItemDTO[];
    events: LiquidityForecastEventDTO[];
  };
  investmentValueSeries: InvestmentValueSeriesItemDTO[];
  netWorth: {
    cashBalance: MoneyString;
    investmentCost: MoneyString;
    investmentValue: MoneyString;
    realizedGain: MoneyString;
    unrealizedGain: MoneyString;
    totalAssets: MoneyString;
    items: InvestmentPerformanceItemDTO[];
  };
}

export interface BalanceReportItemDTO {
  id: UUID;
  name: string;
  accountType: AccountType;
  currencyCode: CurrencyCode;
  balance: MoneyString;
}

export interface BalanceReportResponse {
  items: BalanceReportItemDTO[];
}

export type ContactType = "CUSTOMER" | "SUPPLIER" | "PERSON" | "EMPLOYEE" | "OTHER";

export interface ReceivablePayableReportItemDTO {
  id: UUID;
  name: string;
  contactType: ContactType;
  currencyCode: CurrencyCode;
  balance: MoneyString;
}

export interface ReceivablePayableReportResponse {
  items: ReceivablePayableReportItemDTO[];
}
