import { describe, expect, it, vi } from "vitest";

import { fetchTefasFundPrices, parseFundHistory } from "../../src/modules/funds/fund.provider";

describe("parseFundHistory", () => {
  it("takes the last row's price as the latest NAV", () => {
    const payload = {
      errorCode: null,
      errorMessage: null,
      resultList: [
        { fonKodu: "TLY", tarih: "2026-08-17", fiyat: 8611.792448 },
        { fonKodu: "TLY", tarih: "2026-08-18", fiyat: 8690.327521 },
        { fonKodu: "TLY", tarih: "2026-08-19", fiyat: 8733.161775 },
      ],
    };
    expect(parseFundHistory(payload, "TLY")).toEqual({
      symbol: "TLY",
      price: "8733.161775",
      priceDate: "2026-08-19",
    });
  });

  it("returns null for an unknown fund code (empty resultList)", () => {
    expect(parseFundHistory({ errorCode: null, resultList: [] }, "XYZ")).toBeNull();
  });

  it("returns null when TEFAS reports an error code", () => {
    expect(parseFundHistory({ errorCode: "E1", errorMessage: "bad request", resultList: [] }, "TLY")).toBeNull();
  });

  it("rejects a non-positive price instead of recording a bad price", () => {
    expect(parseFundHistory({ errorCode: null, resultList: [{ tarih: "2026-08-17", fiyat: 0 }] }, "TLY")).toBeNull();
  });

  it("returns null for a missing response", () => {
    expect(parseFundHistory(null, "TLY")).toBeNull();
  });
});

describe("fetchTefasFundPrices", () => {
  it("fetches each symbol's latest NAV and uppercases the requested code", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.fonKodu).toBe("TLY");
      expect(body.periyod).toBe(1);
      return new Response(
        JSON.stringify({ errorCode: null, resultList: [{ tarih: "2026-08-17", fiyat: 8611.79 }] }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchTefasFundPrices(["tly"], fetcher);

    expect(result.points).toEqual([{ symbol: "TLY", price: "8611.79", priceDate: "2026-08-17" }]);
    expect(result.failedSymbols).toEqual([]);
  });

  it("tolerates one symbol having no data while returning the rest", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      if (body.fonKodu === "NEW") return new Response(JSON.stringify({ errorCode: null, resultList: [] }), { status: 200 });
      return new Response(JSON.stringify({ errorCode: null, resultList: [{ tarih: "2026-08-17", fiyat: 1.23 }] }), { status: 200 });
    }) as typeof fetch;

    const result = await fetchTefasFundPrices(["AFA", "NEW"], fetcher);

    expect(result.points).toEqual([{ symbol: "AFA", price: "1.23", priceDate: "2026-08-17" }]);
    expect(result.failedSymbols).toEqual([]);
  });

  it("throws when the source is down for every requested symbol", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 503 })) as typeof fetch;

    await expect(fetchTefasFundPrices(["AFA"], fetcher)).rejects.toThrow("TEFAS fund price batch failed");
  });

  it("returns immediately for an empty symbol list without calling fetch", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;

    const result = await fetchTefasFundPrices([], fetcher);

    expect(result).toEqual({ failedSymbols: [], points: [] });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("passes a custom lookback window through to the request", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body.periyod).toBe(36);
      return new Response(JSON.stringify({ errorCode: null, resultList: [{ tarih: "2026-08-17", fiyat: 1 }] }), { status: 200 });
    }) as typeof fetch;

    await fetchTefasFundPrices(["TLY"], fetcher, 36);
  });
});
