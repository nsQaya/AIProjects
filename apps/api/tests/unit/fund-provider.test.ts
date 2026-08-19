import { describe, expect, it, vi } from "vitest";

import { fetchFintablesFundPrices, parseFundHistory } from "../../src/modules/funds/fund.provider";

describe("parseFundHistory", () => {
  it("takes the last bar's close as the latest NAV", () => {
    const payload = {
      s: "ok",
      t: [1786924800, 1787011200, 1787097600],
      c: [8611.792448, 8690.327521, 8733.161775],
    };
    expect(parseFundHistory(payload, "TLY")).toEqual({
      symbol: "TLY",
      price: "8733.161775",
      priceDate: "2026-08-19",
    });
  });

  it("returns null when the series is marked no_data, e.g. an unknown fund code", () => {
    expect(parseFundHistory({ s: "no_data" }, "XYZ")).toBeNull();
  });

  it("returns null for an empty bar series", () => {
    expect(parseFundHistory({ s: "ok", t: [], c: [] }, "TLY")).toBeNull();
  });

  it("rejects a non-positive close instead of recording a bad price", () => {
    expect(parseFundHistory({ s: "ok", t: [1786924800], c: [0] }, "TLY")).toBeNull();
  });

  it("returns null for a missing response", () => {
    expect(parseFundHistory(null, "TLY")).toBeNull();
  });
});

describe("fetchFintablesFundPrices", () => {
  it("fetches each symbol's latest bar and uppercases the requested code", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get("symbol")).toBe("TLY");
      return new Response(JSON.stringify({ s: "ok", t: [1786924800], c: [8611.79] }), { status: 200 });
    }) as typeof fetch;

    const result = await fetchFintablesFundPrices(["tly"], fetcher);

    expect(result.points).toEqual([{ symbol: "TLY", price: "8611.79", priceDate: "2026-08-17" }]);
    expect(result.failedSymbols).toEqual([]);
  });

  it("tolerates one symbol having no data while returning the rest", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const symbol = new URL(String(input)).searchParams.get("symbol");
      if (symbol === "NEW") return new Response(JSON.stringify({ s: "no_data" }), { status: 200 });
      return new Response(JSON.stringify({ s: "ok", t: [1786924800], c: [1.23] }), { status: 200 });
    }) as typeof fetch;

    const result = await fetchFintablesFundPrices(["AFA", "NEW"], fetcher);

    expect(result.points).toEqual([{ symbol: "AFA", price: "1.23", priceDate: "2026-08-17" }]);
    expect(result.failedSymbols).toEqual([]);
  });

  it("throws when the source is down for every requested symbol", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 503 })) as typeof fetch;

    await expect(fetchFintablesFundPrices(["AFA"], fetcher)).rejects.toThrow("Fintables fund price batch failed");
  });

  it("returns immediately for an empty symbol list without calling fetch", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;

    const result = await fetchFintablesFundPrices([], fetcher);

    expect(result).toEqual({ failedSymbols: [], points: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
