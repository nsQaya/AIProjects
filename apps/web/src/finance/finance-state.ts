import type {
  BalanceReportItemDTO,
  BookListItemDTO,
  CategoryDTO,
  CostCenterDTO,
  InvestmentAssetTypeDTO,
  IncomeExpenseCostCenterItemDTO,
  ReceivablePayableReportItemDTO,
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
  categories: readonly (CategoryDTO & { ui: { kind: "income" | "expense" } })[];
  costCenters: readonly CostCenterDTO[];
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
  balanceReportItems: readonly BalanceReportItemDTO[];
  receivablePayableReportItems: readonly ReceivablePayableReportItemDTO[];
  investmentTypes: readonly InvestmentAssetTypeDTO[];
  instruments: readonly InvestmentInstrumentView[];
  lots: readonly InvestmentLotView[];
  sales: readonly InvestmentSaleView[];
  portfolio: readonly InvestmentPortfolioItemView[];
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
    categories: [],
    costCenters: [],
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
    balanceReportItems: [],
    receivablePayableReportItems: [],
    investmentTypes: [],
    instruments: [],
    lots: [],
    sales: [],
    portfolio: [],
  };
}
