import type { UUID } from "@defterx/contracts";

import type { CashFlowRange, CashFlowVisibility, FinanceSnapshot } from "../../finance";

export type DashboardSnapshot = Pick<
  FinanceSnapshot,
  | "accounts"
  | "categories"
  | "transactions"
  | "upcoming"
  | "dashboard"
  | "cashflow"
  | "cashflowRange"
  | "cashflowVisible"
  | "cashflowAccountIds"
>;

export interface DashboardCallbacks {
  /** FinanceService owns request sequencing and discards stale responses. */
  onCashflowRangeChange: (range: CashFlowRange) => Promise<unknown>;
  /** The callback must reload server-authored period balances for this account scope. */
  onCashflowAccountsChange: (accountIds: readonly UUID[]) => Promise<unknown>;
  onCashflowVisibilityChange: (patch: Partial<CashFlowVisibility>) => void;
}

export interface DashboardPageProps extends DashboardCallbacks {
  busy?: boolean;
  snapshot: DashboardSnapshot;
}
