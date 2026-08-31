import { summarizeAccountPortfolio } from "./account-portfolio";
import type {
  InvestmentBrokerageAccount,
  InvestmentLotViewModel,
  InvestmentPortfolioViewModel,
} from "./investment-types";

function account(overrides: Partial<InvestmentBrokerageAccount> & { id: string }): InvestmentBrokerageAccount {
  return {
    name: overrides.id,
    currencyCode: "TRY",
    displayBalance: "0",
    displayBalanceTry: overrides.displayBalanceTry ?? overrides.displayBalance ?? "0",
    isArchived: false,
    ...overrides,
  };
}

function position(
  overrides: Partial<InvestmentPortfolioViewModel> & { instrumentId: string },
): InvestmentPortfolioViewModel {
  return {
    name: overrides.instrumentId,
    symbol: null,
    assetTypeName: "Hisse",
    currencyCode: "TRY",
    quantity: "10",
    costBasis: "1000",
    realizedGain: "0",
    latestPrice: "120",
    latestPriceAt: "2026-08-20T12:00:00.000Z",
    currentValue: "1200",
    gain: "200",
    gainPercent: "20",
    costBasisTRY: "1000",
    currentValueTRY: "1200",
    gainTRY: "200",
    ...overrides,
  };
}

function lot(
  overrides: Partial<InvestmentLotViewModel> & { id: string; instrumentId: string },
): InvestmentLotViewModel {
  return {
    instrumentName: overrides.instrumentId,
    symbol: null,
    currencyCode: "TRY",
    accountId: null,
    accountName: null,
    quantity: "10",
    unitPrice: "100",
    costBasis: "1000",
    purchasedAt: "2026-01-10T09:00:00.000Z",
    notes: null,
    kind: "PURCHASE",
    posted: true,
    version: 1,
    ...overrides,
  };
}

describe("summarizeAccountPortfolio", () => {
  it("files a position under the account that purchased the most of it", () => {
    const summary = summarizeAccountPortfolio(
      [position({ instrumentId: "thyao" })],
      [
        lot({ id: "l1", instrumentId: "thyao", accountId: "acct-a", quantity: "6" }),
        lot({ id: "l2", instrumentId: "thyao", accountId: "acct-b", quantity: "4" }),
      ],
      [account({ id: "acct-a" }), account({ id: "acct-b" })],
    );

    const a = summary.groups.find((g) => g.accountId === "acct-a")!;
    const b = summary.groups.find((g) => g.accountId === "acct-b")!;
    expect(a.positions.map((p) => p.instrumentId)).toEqual(["thyao"]);
    expect(b.positions).toEqual([]);
    expect(summary.groups.some((g) => g.accountId === null)).toBe(false);
  });

  it("routes a position with no account-linked lot to the unlinked group", () => {
    const summary = summarizeAccountPortfolio(
      [position({ instrumentId: "old", currentValueTRY: "500", costBasisTRY: "400" })],
      [lot({ id: "l1", instrumentId: "old", accountId: null })],
      [account({ id: "acct-a", displayBalance: "100" })],
    );

    const unlinked = summary.groups.find((g) => g.accountId === null)!;
    expect(unlinked.name).toBe("Bağlanmamış pozisyonlar");
    expect(unlinked.cash).toBeNull();
    expect(unlinked.total).toBeNull();
    expect(unlinked.positionsValue).toBe(500);
  });

  it("keeps a bonus-issue (null account) lot from dragging a linked position to unlinked", () => {
    const summary = summarizeAccountPortfolio(
      [position({ instrumentId: "thyao" })],
      [
        lot({ id: "l1", instrumentId: "thyao", accountId: "acct-a", quantity: "10" }),
        lot({ id: "l2", instrumentId: "thyao", accountId: null, quantity: "5", kind: "CAPITAL_INCREASE" }),
      ],
      [account({ id: "acct-a" })],
    );

    expect(summary.groups.find((g) => g.accountId === "acct-a")!.positions).toHaveLength(1);
    expect(summary.groups.some((g) => g.accountId === null)).toBe(false);
  });

  it("still yields a cash-only group for a live account with no positions", () => {
    const summary = summarizeAccountPortfolio(
      [],
      [],
      [account({ id: "acct-a", displayBalance: "2500.50" })],
    );

    const a = summary.groups[0]!;
    expect(a.positions).toEqual([]);
    expect(a.positionsValue).toBe(0);
    expect(a.total).toBe(2500.5);
    expect(summary.totalCash).toBe(2500.5);
  });

  it("drops an empty archived account but keeps one that still holds cash, ordered after live accounts", () => {
    const summary = summarizeAccountPortfolio(
      [position({ instrumentId: "thyao" })],
      [lot({ id: "l1", instrumentId: "thyao", accountId: "live", quantity: "10" })],
      [
        account({ id: "live", displayBalance: "100" }),
        account({ id: "empty-archived", isArchived: true, displayBalance: "0" }),
        account({ id: "funded-archived", isArchived: true, displayBalance: "50" }),
      ],
    );

    expect(summary.groups.map((g) => g.accountId)).toEqual(["live", "funded-archived"]);
    expect(summary.groups[1]!.isArchived).toBe(true);
    // Archived balances are real money, so they count toward the page total.
    expect(summary.totalCash).toBe(150);
  });

  it("totals a foreign-currency account from its TRY-converted cash, not the native balance", () => {
    const summary = summarizeAccountPortfolio(
      [position({ instrumentId: "aapl", currencyCode: "USD", currentValueTRY: "21000" })],
      [lot({ id: "l1", instrumentId: "aapl", accountId: "piapiri-usd", currencyCode: "USD" })],
      [
        account({
          id: "piapiri-usd",
          currencyCode: "USD",
          displayBalance: "400",
          displayBalanceTry: "14000",
        }),
      ],
    );

    const group = summary.groups[0]!;
    expect(group.cash).toBe("400"); // shown natively as $400
    expect(group.cashTry).toBe(14000);
    expect(group.positionsValue).toBe(21000);
    expect(group.total).toBe(35000); // 14.000 TL nakit + 21.000 TL pozisyon
    expect(summary.totalCash).toBe(14000);
  });

  it("values positions with currentValueTRY, falling back to costBasisTRY, and totals cash + positions", () => {
    const summary = summarizeAccountPortfolio(
      [
        position({ instrumentId: "priced", currentValueTRY: "1200", costBasisTRY: "1000" }),
        position({ instrumentId: "unpriced", currentValueTRY: null, costBasisTRY: "800" }),
      ],
      [
        lot({ id: "l1", instrumentId: "priced", accountId: "acct-a" }),
        lot({ id: "l2", instrumentId: "unpriced", accountId: "acct-a" }),
      ],
      [account({ id: "acct-a", displayBalance: "300" })],
    );

    const a = summary.groups[0]!;
    expect(a.positionsValue).toBe(2000);
    expect(a.positionsCost).toBe(1800);
    expect(a.total).toBe(2300);
    expect(summary.positionsValue).toBe(2000);
  });
});
