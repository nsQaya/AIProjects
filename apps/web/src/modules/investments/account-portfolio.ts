import type { MoneyString, UUID } from "@defterx/contracts";

import { toNumber } from "../../lib/format";
import type {
  InvestmentBrokerageAccount,
  InvestmentLotViewModel,
  InvestmentPortfolioViewModel,
} from "./investment-types";

/** One brokerage account (or the "unlinked" bucket) with the positions funded through it. */
export interface AccountPortfolioGroup {
  /** null marks the synthetic "Bağlanmamış" group for positions with no linked account. */
  readonly accountId: UUID | null;
  readonly name: string;
  readonly currencyCode: string | null;
  readonly isArchived: boolean;
  /** Available cash in the account's own currency; null for the unlinked group. */
  readonly cash: MoneyString | null;
  /** Available cash converted to TRY; null for the unlinked group. */
  readonly cashTry: number | null;
  /** Σ costBasisTRY of the group's positions. */
  readonly positionsCost: number;
  /** Σ (currentValueTRY ?? costBasisTRY) — same fallback the page hero uses. */
  readonly positionsValue: number;
  /** cashTry + positionsValue (all TRY); null when the group has no cash concept. */
  readonly total: number | null;
  readonly positions: readonly InvestmentPortfolioViewModel[];
}

export interface AccountPortfolioSummary {
  /** Live accounts first (input order), then archived ones that still hold value, then the unlinked group. */
  readonly groups: readonly AccountPortfolioGroup[];
  /** Σ cash across every brokerage account in TRY (archived included — the balance is still real). */
  readonly totalCash: number;
  /** Σ positionsValue across all groups (equals the page hero's position total). */
  readonly positionsValue: number;
  readonly positionsCost: number;
}

/**
 * Picks the account that funded the most of an instrument's position: the
 * account_id with the largest purchased quantity among lots that actually name
 * an account. Lots with no account (old un-linked lots, bonus-issue capital
 * increases) never win — the position lives wherever the real money went in.
 * Returns null when no lot names an account.
 */
function dominantAccountId(
  instrumentId: UUID,
  lots: readonly InvestmentLotViewModel[],
): UUID | null {
  const byAccount = new Map<UUID, number>();
  for (const lot of lots) {
    if (lot.instrumentId !== instrumentId || lot.accountId === null) continue;
    byAccount.set(lot.accountId, (byAccount.get(lot.accountId) ?? 0) + toNumber(lot.quantity));
  }
  let winner: UUID | null = null;
  let best = -Infinity;
  for (const [accountId, quantity] of byAccount) {
    if (quantity > best) {
      best = quantity;
      winner = accountId;
    }
  }
  return winner;
}

function positionsValue(positions: readonly InvestmentPortfolioViewModel[]): number {
  return positions.reduce(
    (sum, item) => sum + toNumber(item.currentValueTRY ?? item.costBasisTRY),
    0,
  );
}

function positionsCost(positions: readonly InvestmentPortfolioViewModel[]): number {
  return positions.reduce((sum, item) => sum + toNumber(item.costBasisTRY), 0);
}

/**
 * Groups open portfolio positions under the brokerage account that funded them
 * so the investments page can show "how much do I have at Piapiri" per account
 * (cash + positions + total), plus a residual "Bağlanmamış" group.
 */
export function summarizeAccountPortfolio(
  portfolio: readonly InvestmentPortfolioViewModel[],
  lots: readonly InvestmentLotViewModel[],
  brokerageAccounts: readonly InvestmentBrokerageAccount[],
): AccountPortfolioSummary {
  const buckets = new Map<UUID | null, InvestmentPortfolioViewModel[]>();
  for (const position of portfolio) {
    const key = dominantAccountId(position.instrumentId, lots);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(position);
    else buckets.set(key, [position]);
  }

  const accountGroup = (account: InvestmentBrokerageAccount): AccountPortfolioGroup => {
    const positions = buckets.get(account.id) ?? [];
    const value = positionsValue(positions);
    const cashTry = toNumber(account.displayBalanceTry);
    return {
      accountId: account.id,
      name: account.name,
      currencyCode: account.currencyCode,
      isArchived: account.isArchived,
      cash: account.displayBalance,
      cashTry,
      positionsCost: positionsCost(positions),
      positionsValue: value,
      total: cashTry + value,
      positions,
    };
  };

  const live = brokerageAccounts.filter((account) => !account.isArchived).map(accountGroup);
  // An archived account only clutters the page when it is truly empty.
  const archived = brokerageAccounts
    .filter(
      (account) =>
        account.isArchived &&
        (toNumber(account.displayBalance) !== 0 || (buckets.get(account.id)?.length ?? 0) > 0),
    )
    .map(accountGroup);

  const groups: AccountPortfolioGroup[] = [...live, ...archived];

  const unlinkedPositions = buckets.get(null) ?? [];
  if (unlinkedPositions.length > 0) {
    const value = positionsValue(unlinkedPositions);
    groups.push({
      accountId: null,
      name: "Bağlanmamış pozisyonlar",
      currencyCode: null,
      isArchived: false,
      cash: null,
      cashTry: null,
      positionsCost: positionsCost(unlinkedPositions),
      positionsValue: value,
      total: null,
      positions: unlinkedPositions,
    });
  }

  return {
    groups,
    totalCash: brokerageAccounts.reduce((sum, account) => sum + toNumber(account.displayBalanceTry), 0),
    positionsValue: positionsValue(portfolio),
    positionsCost: positionsCost(portfolio),
  };
}
