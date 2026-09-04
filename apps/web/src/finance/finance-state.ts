import type {
  AccountTypeDTO,
  BalanceReportItemDTO,
  BookListItemDTO,
  CategoryDTO,
  CostCenterDTO,
  CurrencyDTO,
  InvestmentAssetTypeDTO,
  InvestmentBrokerageAccountDTO,
  IncomeExpenseCostCenterItemDTO,
  ReceivablePayableReportItemDTO,
  ReportAnalyticsResponse,
  ReportGranularity,
  UUID,
} from "@defterx/contracts";
import type { AuthUser } from "../platform/auth/auth-schemas";
import type { CashFlowRange } from "./finance-query";
import type {
  AccountView,
  CashFlowView,
  DashboardView,
  IncomeExpenseReportItemView,
  InvestmentInstrumentView,
  InvestmentLotView,
  InvestmentPortfolioItemView,
  InvestmentSaleView,
  ScheduledTransactionView,
  SharedAccountView,
  TransactionView,
} from "./finance-views";

export type FinancePhase = "idle" | "loading" | "ready";
export type UpcomingFilter = "OPEN" | "COMPLETED" | "ALL";

export interface TransactionFilter {
  accountIds?: readonly UUID[];
  from?: string;
  to?: string;
  categoryId?: UUID;
  costCenterId?: UUID;
}

export interface ReportRange {
  from?: string;
  to?: string;
  accountIds?: readonly UUID[];
  granularity?: ReportGranularity;
}

export interface CashFlowVisibility {
  income: boolean;
  expense: boolean;
  balance: boolean;
}

export interface CashFlowMeta {
  from: string;
  to: string;
  granularity: "day" | "week" | "month" | "year";
}

export interface FinanceSnapshot {
  phase: FinancePhase;
  refreshing: boolean;
  revision: number;
  lastUpdatedAt: string | null;
  user: AuthUser | null;
  book: BookListItemDTO | null;
  accounts: readonly AccountView[];
  /** Accounts other users have shared with the signed-in user. Kept out of dashboard/report/net-worth totals. */
  sharedAccounts: readonly SharedAccountView[];
  accountTypes: readonly AccountTypeDTO[];
  categories: readonly (CategoryDTO & { ui: { kind: "income" | "expense" } })[];
  costCenters: readonly CostCenterDTO[];
  currencies: readonly CurrencyDTO[];
  transactions: readonly TransactionView[];
  transactionOpeningBalance: string;
  transactionOpeningBalanceValue: number;
  transactionNextCursor: string | null;
  transactionFilter: TransactionFilter;
  upcoming: readonly ScheduledTransactionView[];
  upcomingFilter: UpcomingFilter;
  dashboard: DashboardView;
  cashflow: readonly CashFlowView[];
  cashflowRange: CashFlowRange;
  cashflowMeta: CashFlowMeta | null;
  cashflowVisible: CashFlowVisibility;
  cashflowAccountIds: readonly UUID[];
  cashflowAccountsInitialized: boolean;
  reportItems: readonly IncomeExpenseReportItemView[];
  reportCostCenters: readonly IncomeExpenseCostCenterItemDTO[];
  reportRange: ReportRange;
  reportRangeExplicit: boolean;
  reportAnalytics: ReportAnalyticsResponse | null;
  reportLoadFailed: boolean;
  balanceReportItems: readonly BalanceReportItemDTO[];
  receivablePayableReportItems: readonly ReceivablePayableReportItemDTO[];
  investmentTypes: readonly InvestmentAssetTypeDTO[];
  instruments: readonly InvestmentInstrumentView[];
  lots: readonly InvestmentLotView[];
  sales: readonly InvestmentSaleView[];
  portfolio: readonly InvestmentPortfolioItemView[];
  brokerageAccounts: readonly InvestmentBrokerageAccountDTO[];
}

export const emptyDashboard: DashboardView = {
  month: { income: "0", expense: "0" },
  importantAccounts: [],
  recentTransactions: [],
  upcoming: [],
  ui: { income: 0, expense: 0 },
};

export function createInitialFinanceSnapshot(): FinanceSnapshot {
  return {
    phase: "idle",
    refreshing: false,
    revision: 0,
    lastUpdatedAt: null,
    user: null,
    book: null,
    accounts: [],
    sharedAccounts: [],
    accountTypes: [],
    categories: [],
    costCenters: [],
    currencies: [],
    transactions: [],
    transactionOpeningBalance: "0",
    transactionOpeningBalanceValue: 0,
    transactionNextCursor: null,
    transactionFilter: {},
    upcoming: [],
    upcomingFilter: "OPEN",
    dashboard: emptyDashboard,
    cashflow: [],
    cashflowRange: "6M",
    cashflowMeta: null,
    cashflowVisible: { income: true, expense: true, balance: true },
    cashflowAccountIds: [],
    cashflowAccountsInitialized: false,
    reportItems: [],
    reportCostCenters: [],
    reportRange: {},
    reportRangeExplicit: false,
    reportAnalytics: null,
    reportLoadFailed: false,
    balanceReportItems: [],
    receivablePayableReportItems: [],
    investmentTypes: [],
    instruments: [],
    lots: [],
    sales: [],
    portfolio: [],
    brokerageAccounts: [],
  };
}
