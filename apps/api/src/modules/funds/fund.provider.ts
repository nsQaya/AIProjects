export interface FundPricePoint {
  price: string;
  priceDate: string;
  symbol: string;
}

// TEFAS itself sits behind an F5 bot-defense JS challenge that a plain fetch()
// can never pass (confirmed: even the front page 403s without a real browser).
// fintables.com mirrors the same TEFAS NAV data through a TradingView-UDF-
// compatible endpoint that, with a browser-shaped Accept/Referer pair, is not
// gated the same way - unlike its own HTML pages, which are. This only ever
// gives us the latest points in a lookback window, not deep history.
const historyUrl = "https://markets.fintables.com/barbar/udf/history";
const lookbackDays = 14;

const requestHeaders = {
  Accept: "application/json",
  Referer: "https://fintables.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
};

interface UdfHistoryResponse {
  c?: unknown[];
  s?: string;
  t?: unknown[];
}

export function parseFundHistory(payload: UdfHistoryResponse | null, symbol: string): FundPricePoint | null {
  if (!payload || payload.s !== "ok") return null;
  const timestamps = payload.t ?? [];
  const closes = payload.c ?? [];
  const lastIndex = timestamps.length - 1;
  if (lastIndex < 0) return null;
  const timestamp = timestamps[lastIndex];
  const close = closes[lastIndex];
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) return null;
  return {
    price: String(close),
    priceDate: new Date(timestamp * 1000).toISOString().slice(0, 10),
    symbol,
  };
}

export async function fetchFintablesFundPrices(
  symbols: readonly string[],
  fetcher: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<{ failedSymbols: string[]; points: FundPricePoint[] }> {
  if (symbols.length === 0) return { failedSymbols: [], points: [] };
  const to = Math.floor(now.getTime() / 1000);
  const from = to - lookbackDays * 86_400;
  const results = await Promise.allSettled(symbols.map(async (rawSymbol) => {
    const symbol = rawSymbol.trim().toUpperCase();
    const url = new URL(historyUrl);
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("resolution", "D");
    url.searchParams.set("from", String(from));
    url.searchParams.set("to", String(to));
    const response = await fetcher(url.toString(), { headers: requestHeaders });
    if (response.status === 404) return null;
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`Fintables temporarily unavailable (${response.status})`);
    }
    if (!response.ok) return null;
    return parseFundHistory(await response.json(), symbol);
  }));
  const points: FundPricePoint[] = [];
  const failedSymbols: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") failedSymbols.push(symbols[index]!);
    else if (result.value) points.push(result.value);
  });
  if (failedSymbols.length === symbols.length) throw new Error("Fintables fund price batch failed");
  return { failedSymbols, points };
}
