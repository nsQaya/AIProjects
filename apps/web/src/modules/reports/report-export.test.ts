import type { ReportAnalyticsResponse } from "@defterx/contracts";

import { money } from "../../lib/format";
import {
  accountBalancesTable,
  instrumentComparisonTable,
  liquidityEventsTable,
  netWorthPerformanceTable,
  reportPeriodMeta,
} from "./report-export";

type Comparison = ReportAnalyticsResponse["instrumentComparison"];

type NetWorth = ReportAnalyticsResponse["netWorth"];

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

const meta = reportPeriodMeta("2026-08-01T00:00:00.000Z", "2026-08-31T23:59:59.999Z", "Tüm hesaplar");

describe("report-export tables", () => {
  it("builds the investment-performance table in TRY with a bold total row", () => {
    const netWorth: NetWorth = {
      cashBalance: "0",
      investmentCost: "1000",
      investmentValue: "1200",
      realizedGain: "50",
      unrealizedGain: "200",
      totalAssets: "1200",
      cashAccounts: [],
      items: [
        position({
          instrumentId: "i1", name: "Aselsan", symbol: "ASELS",
          costBasis: "1000", currentValue: "1200",
          costBasisTRY: "1000", currentValueTRY: "1200", realizedGainTRY: "50", unrealizedGainTRY: "200",
          realizedGain: "50", unrealizedGain: "200",
        }),
        position({ instrumentId: "i2", name: "US Co", symbol: "USCO", currencyCode: "USD", currentValue: "10" }),
      ],
    };

    const table = netWorthPerformanceTable(netWorth, meta);
    expect(table.title).toBe("Yatırım Performansı");
    expect(table.meta).toEqual(meta);
    expect(table.rows[0]?.[0]).toBe("Aselsan (ASELS)");
    expect(table.rows[0]?.[2]).toEqual({ value: 1000, text: money(1000) });
    // Foreign position with no TRY rate keeps a note instead of a number.
    expect(table.rows[1]?.[2]).toBe("kur yok");
    expect(table.rows[1]?.[3]).toBe("kur yok");
    expect(table.totalRow?.[0]).toBe("TOPLAM");
    expect(table.totalRow?.[3]).toEqual({ value: 1200, text: money(1200) });
  });

  it("omits the total row when there are no positions", () => {
    const table = netWorthPerformanceTable(
      { cashBalance: "0", investmentCost: "0", investmentValue: "0", realizedGain: "0", unrealizedGain: "0", totalAssets: "0", cashAccounts: [], items: [] },
      meta,
    );
    expect(table.rows).toEqual([]);
    expect(table.totalRow).toBeUndefined();
  });

  it("builds the account-balances table from each account's latest point", () => {
    const table = accountBalancesTable(
      {
        accounts: [{ id: "a1", name: "Banka", currencyCode: "TRY" }],
        items: [
          { accountId: "a1", balance: "100", period: "2026-07", periodStart: "2026-07-01T00:00:00.000Z" },
          { accountId: "a1", balance: "250.5", period: "2026-08", periodStart: "2026-08-01T00:00:00.000Z" },
        ],
      },
      meta,
    );
    expect(table.rows).toEqual([["Banka", { value: 250.5, text: money(250.5) }]]);
  });

  it("builds the liquidity events table with formatted dates and impact", () => {
    const table = liquidityEventsTable(
      {
        openingBalance: "0",
        items: [],
        events: [
          { id: "e1", title: "Kira", scheduledAt: "2026-09-01T09:00:00.000Z", type: "EXPENSE", impact: "-5000", realized: false },
          { id: "e2", title: "Taksit", scheduledAt: "2026-09-04T09:00:00.000Z", type: "EXPENSE", impact: "-1200", realized: true },
        ],
      },
      meta,
    );
    expect(table.rows[0]?.[1]).toBe("Kira");
    expect(table.rows[0]?.[3]).toBe("Planlı");
    expect(table.rows[0]?.[4]).toEqual({ value: -5000, text: money(-5000) });
    expect(table.rows[1]?.[3]).toBe("Gerçekleşen");
  });

  it("builds the comparison table with account totals then instrument lines and rebased change", () => {
    const comparison: Comparison = {
      accounts: [{ accountId: "a1", name: "Piapiri" }],
      instruments: [
        { instrumentId: "i1", name: "Fon", symbol: "FON", assetTypeName: "Yatırım Fonu", currencyCode: "TRY", accountId: "a1", accountName: "Piapiri" },
        { instrumentId: "i2", name: "Coin", symbol: "CN", assetTypeName: "Kripto", currencyCode: "USD", accountId: null, accountName: null },
      ],
      instrumentPoints: [
        { instrumentId: "i1", period: "2026-07", periodStart: "2026-07-01T00:00:00.000Z", price: "10" },
        { instrumentId: "i1", period: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", price: "15" },
        { instrumentId: "i2", period: "2026-07", periodStart: "2026-07-01T00:00:00.000Z", price: null },
        { instrumentId: "i2", period: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", price: null },
      ],
      accountPoints: [
        { accountId: "a1", period: "2026-07", periodStart: "2026-07-01T00:00:00.000Z", value: "1000" },
        { accountId: "a1", period: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", value: "1250" },
      ],
    };

    const table = instrumentComparisonTable(comparison, { accountIds: ["a1"], instrumentIds: ["i1", "i2"] }, meta);
    expect(table.title).toBe("Varlık Değişim Karşılaştırması");
    // Account total row first.
    expect(table.rows[0]?.[0]).toBe("Piapiri");
    expect(table.rows[0]?.[1]).toBe("Hesap yekünü");
    expect(table.rows[0]?.[4]).toEqual({ value: 25, text: "%25.00" });
    // Then instrument lines, by asset type.
    expect(table.rows[1]?.[0]).toBe("Fon (FON)");
    expect(table.rows[1]?.[1]).toBe("Yatırım Fonu");
    expect(table.rows[1]?.[4]).toEqual({ value: 50, text: "%50.00" });
    // No known price -> em dash, no change.
    expect(table.rows[2]?.[2]).toBe("—");
    expect(table.rows[2]?.[4]).toBe("—");
  });
});
