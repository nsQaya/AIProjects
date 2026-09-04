import type { MoneyString, UUID } from "@defterx/contracts";

import { toNumber } from "../../lib/format";
import type {
  InvestmentBrokerageAccount,
  InvestmentLotViewModel,
  InvestmentPortfolioViewModel,
  InvestmentSaleViewModel,
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
 * Net open units of an instrument per brokerage account: units bought through
 * that account (its lots) minus units whose sale proceeds landed back in it
 * (sales carry the destination account). Un-linked lots — old data, bonus-issue
 * capital increases — collect under the `null` key. Accounts that no longer hold
 * any of the instrument are simply absent.
 */
function netUnitsByAccount(
  instrumentId: UUID,
  lots: readonly InvestmentLotViewModel[],
  sales: readonly InvestmentSaleViewModel[],
): Map<UUID | null, number> {
  const net = new Map<UUID | null, number>();
  for (const lot of lots) {
    if (lot.instrumentId !== instrumentId) continue;
    net.set(lot.accountId, (net.get(lot.accountId) ?? 0) + toNumber(lot.quantity));
  }
  for (const sale of sales) {
    if (sale.instrumentId !== instrumentId) continue;
    net.set(sale.destinationAccountId, (net.get(sale.destinationAccountId) ?? 0) - toNumber(sale.quantity));
  }
  return net;
}

/**
 * A slice of an aggregated position: every amount/quantity field multiplied by
 * `fraction`, while ratio-style fields (unit price, gain %) stay as they are.
 * `fraction >= 1` returns the position untouched.
 */
function slicePosition(
  base: InvestmentPortfolioViewModel,
  fraction: number,
): InvestmentPortfolioViewModel {
  if (fraction >= 1) return base;
  const scale = (value: MoneyString | null): MoneyString | null =>
    value === null ? null : String(Number((toNumber(value) * fraction).toFixed(6)));
  return {
    ...base,
    quantity: scale(base.quantity)!,
    costBasis: scale(base.costBasis)!,
    currentValue: scale(base.currentValue),
    gain: scale(base.gain),
    costBasisTRY: scale(base.costBasisTRY),
    currentValueTRY: scale(base.currentValueTRY),
    gainTRY: scale(base.gainTRY),
  };
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
 * Groups open portfolio positions under the brokerage account(s) that hold them
 * so the investments page can show "how much do I have at Piapiri" per account
 * (cash + positions + total), plus a residual "Bağlanmamış" group. A position
 * held at more than one custodian is split across them by net units, so the
 * same fund shows under every account that actually holds it.
 */
export function summarizeAccountPortfolio(
  portfolio: readonly InvestmentPortfolioViewModel[],
  lots: readonly InvestmentLotViewModel[],
  sales: readonly InvestmentSaleViewModel[],
  brokerageAccounts: readonly InvestmentBrokerageAccount[],
): AccountPortfolioSummary {
  const buckets = new Map<UUID | null, InvestmentPortfolioViewModel[]>();
  const addToBucket = (key: UUID | null, position: InvestmentPortfolioViewModel) => {
    const bucket = buckets.get(key);
    if (bucket) bucket.push(position);
    else buckets.set(key, [position]);
  };

  for (const position of portfolio) {
    const net = netUnitsByAccount(position.instrumentId, lots, sales);
    // Only real accounts that still hold a positive net can carry the position;
    // the null (un-linked) key never splits it - a bonus issue belongs wherever
    // the base shares are.
    const holders = [...net].filter(
      (entry): entry is [UUID, number] => entry[0] !== null && entry[1] > 1e-6,
    );
    if (holders.length === 0) {
      addToBucket(null, position);
      continue;
    }
    if (holders.length === 1) {
      addToBucket(holders[0]![0], position);
      continue;
    }
    // Held across several accounts (the same fund at two custodians): show it
    // under each, split proportionally to net units. The largest holder is
    // assigned last and absorbs the rounding remainder so the slices still add
    // up to the whole position.
    holders.sort((a, b) => a[1] - b[1]);
    const totalUnits = holders.reduce((sum, [, units]) => sum + units, 0);
    let assigned = 0;
    holders.forEach(([accountId, units], index) => {
      const fraction = index === holders.length - 1 ? Math.max(0, 1 - assigned) : units / totalUnits;
      assigned += fraction;
      addToBucket(accountId, slicePosition(position, fraction));
    });
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
