import type { DbClient } from "../../src/infrastructure/database";
import { loadReportAnalytics } from "../../src/modules/reports/report.analytics";
import { describe, expect, it, vi } from "vitest";

const BOOK_ID = "00000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";
const INSTRUMENT_ID = "00000000-0000-4000-8000-000000000003";

describe("report analytics", () => {
  it("composes all five report datasets under one stable filter contract", async () => {
    const calls: unknown[][] = [];
    const responses = [
      [{ currencyCode: "TRY" }],
      [{ period: "2026-08", month: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", income: "100", expense: "40", net: "60", balance: "160" }],
      [{ accountId: ACCOUNT_ID, name: "Banka", currencyCode: "TRY", period: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", balance: "160" }],
      [],
      [],
      [{ period: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", inflow: "30", outflow: "10", net: "20", projectedBalance: "180", openingBalance: "160" }],
      [],
      [{ instrumentId: INSTRUMENT_ID, name: "Fon", symbol: "FON", assetTypeName: "Fon", currencyCode: "TRY", quantity: "1", costBasis: "100", currentValue: "120", realizedGain: "5", unrealizedGain: "20", latestPriceAt: "2026-08-14T00:00:00.000Z", investmentCost: "100", investmentValue: "120", totalRealizedGain: "5", totalUnrealizedGain: "20" }],
      [{ period: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", value: "120" }],
      [{ cashBalance: "160" }],
    ];
    let call = 0;
    const pool = {
      query: vi.fn(async (_sql: string, values: unknown[]) => {
        calls.push(values);
        return { rows: responses[call++]!, rowCount: 1 };
      }),
    } as unknown as DbClient;

    const report = await loadReportAnalytics(pool, {
      bookId: BOOK_ID,
      from: "2026-08-01T00:00:00.000Z",
      to: "2026-08-31T23:59:59.999Z",
      accountIds: [ACCOUNT_ID],
      includeAllAccounts: false,
      granularity: "month",
    });

    expect(report.trend[0]?.net).toBe("60");
    expect(report.accountBalances.accounts).toEqual([{ id: ACCOUNT_ID, name: "Banka", currencyCode: "TRY" }]);
    expect(report.liquidity.openingBalance).toBe("160");
    expect(report.liquidity.items[0]).not.toHaveProperty("openingBalance");
    expect(report.netWorth.totalAssets).toBe("280");
    expect(report.netWorth.items[0]?.instrumentId).toBe(INSTRUMENT_ID);
    expect(calls[1]).toEqual([
      BOOK_ID,
      "2026-08-01T00:00:00.000Z",
      "2026-08-31T23:59:59.999Z",
      [ACCOUNT_ID],
      false,
      "month",
      "1 month",
      "YYYY-MM",
    ]);
    expect(calls[3]).toEqual([
      BOOK_ID,
      "2026-08-01T00:00:00.000Z",
      "2026-08-31T23:59:59.999Z",
      [ACCOUNT_ID],
      false,
    ]);
    expect(calls.map((values) => values.length)).toEqual([1, 8, 8, 5, 5, 8, 5, 5, 8, 5]);
  });
});
