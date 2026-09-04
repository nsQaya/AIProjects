import type {
  AccountDTO,
  CashFlowGranularity,
  CashFlowItemDTO,
  DashboardReportResponse,
  IncomeExpenseReportItemDTO,
  InvestmentInstrumentDTO,
  InvestmentLotDTO,
  InvestmentPortfolioItemDTO,
  InvestmentSaleDTO,
  ScheduledTransactionDTO,
  SharedWithMeAccountDTO,
  TransactionListItemDTO,
} from "@defterx/contracts";
import { cashFlowLabel, isoDay } from "./finance-query";

export interface AccountView extends AccountDTO {
  ui: {
    balance: number;
    displayBalance: number;
    creditLimit: number | null;
    availableCredit: number | null;
  };
}

export interface SharedAccountView extends SharedWithMeAccountDTO {
  ui: {
    balance: number;
    displayBalance: number;
    displayBalanceTry: number;
    creditLimit: number | null;
    availableCredit: number | null;
  };
}

export interface CategoryView {
  kind: "income" | "expense";
}

export interface TransactionView extends TransactionListItemDTO {
  ui: {
    kind: Lowercase<TransactionListItemDTO["type"]>;
    description: string;
    date: string;
    amount: number;
    balanceDelta: number;
    runningBalance: number;
  };
}

export interface ScheduledTransactionView extends ScheduledTransactionDTO {
  ui: {
    kind: Lowercase<ScheduledTransactionDTO["transactionType"]>;
    date: string;
    amount: number;
    categoryName: string;
    costCenterName: string;
  };
}

export interface CashFlowView extends CashFlowItemDTO {
  ui: {
    label: string;
    income: number;
    expense: number;
    net: number;
    balance: number;
  };
}

export interface IncomeExpenseReportItemView extends IncomeExpenseReportItemDTO {
  ui: {
    kind: Lowercase<IncomeExpenseReportItemDTO["type"]>;
    amount: number;
  };
}

export interface InvestmentInstrumentView extends InvestmentInstrumentDTO {
  ui: {
    latestPrice: number | null;
  };
}

export interface InvestmentLotView extends InvestmentLotDTO {
  ui: {
    quantity: number;
    unitPrice: number;
    costBasis: number;
  };
}

export interface InvestmentSaleView extends InvestmentSaleDTO {
  ui: {
    quantity: number;
    unitPrice: number;
    proceeds: number;
    costBasis: number;
    gain: number;
  };
}

export interface InvestmentPortfolioItemView extends InvestmentPortfolioItemDTO {
  ui: {
    quantity: number;
    costBasis: number;
    realizedGain: number;
    latestPrice: number | null;
    currentValue: number | null;
    gain: number | null;
    gainPercent: number | null;
  };
}

export type DashboardView = DashboardReportResponse & {
  ui: {
    income: number;
    expense: number;
  };
  importantAccounts: Array<
    DashboardReportResponse["importantAccounts"][number] & {
      ui: { balance: number; creditLimit: number | null };
    }
  >;
  recentTransactions: Array<
    DashboardReportResponse["recentTransactions"][number] & {
      ui: { amount: number; date: string };
    }
  >;
  upcoming: Array<
    DashboardReportResponse["upcoming"][number] & {
      ui: { amount: number; date: string };
    }
  >;
};

/** UI-only conversion. Never feed these numbers back into a financial mutation. */
export function toUiNumber(value: string): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toOptionalUiNumber(value: string | null): number | null {
  return value === null ? null : toUiNumber(value);
}

export function accountView(account: AccountDTO): AccountView {
  return {
    ...account,
    ui: {
      balance: toUiNumber(account.balance),
      displayBalance: toUiNumber(account.displayBalance),
      creditLimit: toOptionalUiNumber(account.creditLimit),
      availableCredit: toOptionalUiNumber(account.availableCredit),
    },
  };
}

export function sharedAccountView(account: SharedWithMeAccountDTO): SharedAccountView {
  return {
    ...account,
    ui: {
      balance: toUiNumber(account.balance),
      displayBalance: toUiNumber(account.displayBalance),
      displayBalanceTry: toUiNumber(account.displayBalanceTry),
      creditLimit: toOptionalUiNumber(account.creditLimit),
      availableCredit: toOptionalUiNumber(account.availableCredit),
    },
  };
}

/**
 * `title` is the canonical user-facing transaction label. `description` is
 * optional supporting context, such as a reversal reason or scheduled-item
 * realization provenance, and must not replace the label in transaction rows.
 */
export function transactionDisplayTitle(
  transaction: Pick<TransactionListItemDTO, "title" | "description">,
): string {
  return transaction.title;
}

export function transactionView(transaction: TransactionListItemDTO): TransactionView {
  return {
    ...transaction,
    ui: {
      kind: transaction.type.toLowerCase() as Lowercase<TransactionListItemDTO["type"]>,
      description: transactionDisplayTitle(transaction),
      date: isoDay(transaction.transactionDate),
      amount: toUiNumber(transaction.amount),
      balanceDelta: toUiNumber(transaction.balanceDelta),
      runningBalance: toUiNumber(transaction.runningBalance),
    },
  };
}

export function scheduledTransactionView(
  transaction: ScheduledTransactionDTO,
  categoryNames: ReadonlyMap<string, string>,
): ScheduledTransactionView {
  return {
    ...transaction,
    ui: {
      kind: transaction.transactionType.toLowerCase() as Lowercase<
        ScheduledTransactionDTO["transactionType"]
      >,
      date: isoDay(transaction.scheduledAt),
      amount: toUiNumber(transaction.amount),
      categoryName: transaction.categoryId ? (categoryNames.get(transaction.categoryId) ?? "") : "",
      costCenterName: transaction.costCenterName ?? "",
    },
  };
}

export function cashFlowView(
  item: CashFlowItemDTO,
  granularity: CashFlowGranularity,
): CashFlowView {
  return {
    ...item,
    ui: {
      label: cashFlowLabel(item.periodStart, granularity),
      income: toUiNumber(item.income),
      expense: toUiNumber(item.expense),
      net: toUiNumber(item.net),
      balance: toUiNumber(item.balance),
    },
  };
}

export function incomeExpenseReportItemView(
  item: IncomeExpenseReportItemDTO,
): IncomeExpenseReportItemView {
  return {
    ...item,
    ui: {
      kind: item.type.toLowerCase() as Lowercase<IncomeExpenseReportItemDTO["type"]>,
      amount: toUiNumber(item.amount),
    },
  };
}

export function investmentInstrumentView(
  instrument: InvestmentInstrumentDTO,
): InvestmentInstrumentView {
  return {
    ...instrument,
    ui: { latestPrice: toOptionalUiNumber(instrument.latestPrice) },
  };
}

export function investmentLotView(lot: InvestmentLotDTO): InvestmentLotView {
  return {
    ...lot,
    ui: {
      quantity: toUiNumber(lot.quantity),
      unitPrice: toUiNumber(lot.unitPrice),
      costBasis: toUiNumber(lot.costBasis),
    },
  };
}

export function investmentSaleView(sale: InvestmentSaleDTO): InvestmentSaleView {
  return {
    ...sale,
    ui: {
      quantity: toUiNumber(sale.quantity),
      unitPrice: toUiNumber(sale.unitPrice),
      proceeds: toUiNumber(sale.proceeds),
      costBasis: toUiNumber(sale.costBasis),
      gain: toUiNumber(sale.gain),
    },
  };
}

export function investmentPortfolioItemView(
  item: InvestmentPortfolioItemDTO,
): InvestmentPortfolioItemView {
  return {
    ...item,
    ui: {
      quantity: toUiNumber(item.quantity),
      costBasis: toUiNumber(item.costBasis),
      realizedGain: toUiNumber(item.realizedGain),
      latestPrice: toOptionalUiNumber(item.latestPrice),
      currentValue: toOptionalUiNumber(item.currentValue),
      gain: toOptionalUiNumber(item.gain),
      gainPercent: toOptionalUiNumber(item.gainPercent),
    },
  };
}

export function dashboardView(report: DashboardReportResponse): DashboardView {
  return {
    ...report,
    ui: {
      income: toUiNumber(report.month.income),
      expense: toUiNumber(report.month.expense),
    },
    importantAccounts: report.importantAccounts.map((account) => ({
      ...account,
      ui: {
        balance: toUiNumber(account.balance),
        creditLimit: toOptionalUiNumber(account.creditLimit),
      },
    })),
    recentTransactions: report.recentTransactions.map((transaction) => ({
      ...transaction,
      ui: {
        amount: toUiNumber(transaction.amount),
        date: isoDay(transaction.transactionDate),
      },
    })),
    upcoming: report.upcoming.map((transaction) => ({
      ...transaction,
      ui: {
        amount: toUiNumber(transaction.amount),
        date: isoDay(transaction.scheduledAt),
      },
    })),
  };
}
