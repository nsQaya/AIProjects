import type { ReportAnalyticsResponse } from "@defterx/contracts";

import { netWorthBreakdown } from "./report-chart-options";

type NetWorth = ReportAnalyticsResponse["netWorth"];

function netWorth(overrides: Partial<NetWorth> = {}): NetWorth {
  return {
    cashBalance: "0",
    investmentCost: "0",
    investmentValue: "0",
    realizedGain: "0",
    unrealizedGain: "0",
    totalAssets: "0",
    cashAccounts: [],
    items: [],
    ...overrides,
  };
}

function cashAccount(overrides: Partial<NetWorth["cashAccounts"][number]>): NetWorth["cashAccounts"][number] {
  return {
    accountId: "acc",
    name: "Hesap",
    accountTypeName: "Banka",
    currencyCode: "TRY",
    balance: "0",
    balanceTry: "0",
    ...overrides,
  };
}

function position(overrides: Partial<NetWorth["items"][number]>): NetWorth["items"][number] {
  return {
    instrumentId: "ins",
    name: "Enstrüman",
    symbol: null,
    assetTypeName: "Hisse",
    currencyCode: "TRY",
    quantity: "1",
    costBasis: "0",
    currentValue: null,
    realizedGain: "0",
    unrealizedGain: null,
    latestPriceAt: null,
    currentValueTRY: null,
    unrealizedGainTRY: null,
    costBasisTRY: null,
    realizedGainTRY: null,
    ...overrides,
  };
}

describe("netWorthBreakdown", () => {
  it("groups cash by account type and investments by asset type, largest first", () => {
    const { nodes, charted, debt } = netWorthBreakdown(
      netWorth({
        cashAccounts: [
          cashAccount({ accountId: "a1", name: "Ziraat", accountTypeName: "Banka", balanceTry: "3000" }),
          cashAccount({ accountId: "a2", name: "İş Bankası", accountTypeName: "Banka", balanceTry: "1000" }),
          cashAccount({ accountId: "a3", name: "Cüzdan", accountTypeName: "Nakit", balanceTry: "500" }),
        ],
        items: [
          position({ instrumentId: "i1", name: "Aselsan", symbol: "ASELS", assetTypeName: "Hisse", currentValueTRY: "2000" }),
          position({ instrumentId: "i2", name: "Teknoloji Fonu", assetTypeName: "Fon", costBasisTRY: "800" }),
        ],
      }),
    );

    expect(debt).toBe(0);
    expect(charted).toBe(3000 + 1000 + 500 + 2000 + 800);
    expect(nodes.map((node) => node.name)).toEqual(["Nakit", "Yatırım"]);

    const [cash, investment] = nodes;
    expect(cash?.value).toBe(4500);
    expect(cash?.children?.map((child) => child.name)).toEqual(["Banka", "Nakit"]);
    expect(cash?.children?.[0]?.children?.map((child) => child.name)).toEqual(["Ziraat", "İş Bankası"]);
    expect(investment?.children?.map((child) => child.name)).toEqual(["Hisse", "Fon"]);
    expect(investment?.children?.[0]?.children?.[0]?.name).toBe("ASELS");

    // Each account/instrument inherits its type block's colour.
    const bankaBlock = cash?.children?.[0];
    expect(bankaBlock?.children?.every((child) => child.itemStyle?.color === bankaBlock.itemStyle?.color)).toBe(true);
    expect(cash?.itemStyle?.color).not.toBe(investment?.itemStyle?.color);
  });

  it("keeps negative accounts out of the tree and reports them as debt", () => {
    const { nodes, charted, debt } = netWorthBreakdown(
      netWorth({
        cashAccounts: [
          cashAccount({ accountId: "a1", name: "Banka", accountTypeName: "Banka", balanceTry: "5000" }),
          cashAccount({ accountId: "cc", name: "Kredi Kartı", accountTypeName: "Kredi Kartı", balanceTry: "-1500" }),
        ],
      }),
    );

    expect(debt).toBe(-1500);
    expect(charted).toBe(5000);
    expect(nodes).toHaveLength(1);
    expect(nodes[0]?.name).toBe("Nakit");
    expect(nodes[0]?.children?.every((child) => child.name !== "Kredi Kartı")).toBe(true);
  });

  it("returns no nodes when there is nothing positive to chart", () => {
    expect(netWorthBreakdown(netWorth()).nodes).toEqual([]);
  });
});
