export interface FundPricePoint {
  price: string;
  priceDate: string;
  symbol: string;
}

// TEFAS's own HTML pages sit behind an F5 bot-defense JS challenge that a
// plain fetch() can never pass, but this JSON API backing their price-history
// chart is not gated the same way - a bare POST with a browser-shaped
// Accept/Content-Type pair works fine. This is the official NAV source
// (Fintables, our previous provider, only ever mirrored the latest ~14 days
// of it); `periyod` is in months and goes back years, so this same endpoint
// also serves historical backfills, not just the daily "latest NAV" job.
const historyUrl = "https://www.tefas.gov.tr/api/funds/fonFiyatBilgiGetir";
const defaultLookbackMonths = 1;

const requestHeaders = {
  Accept: "application/json",
  "Content-Type": "application/json",
};

interface TefasFundPriceRow {
  fiyat?: unknown;
  fonKodu?: string;
  tarih?: string;
}

interface TefasHistoryResponse {
  errorCode?: string | null;
  errorMessage?: string | null;
  resultList?: TefasFundPriceRow[];
}

export function parseFundHistory(payload: TefasHistoryResponse | null, symbol: string): FundPricePoint | null {
  if (!payload || payload.errorCode) return null;
  const rows = payload.resultList ?? [];
  const last = rows[rows.length - 1];
  if (!last?.tarih) return null;
  const price = typeof last.fiyat === "number" && Number.isFinite(last.fiyat) && last.fiyat > 0 ? String(last.fiyat) : null;
  if (!price) return null;
  return { price, priceDate: last.tarih, symbol };
}

export async function fetchTefasFundPrices(
  symbols: readonly string[],
  fetcher: typeof fetch = fetch,
  lookbackMonths: number = defaultLookbackMonths,
): Promise<{ failedSymbols: string[]; points: FundPricePoint[] }> {
  if (symbols.length === 0) return { failedSymbols: [], points: [] };
  const results = await Promise.allSettled(symbols.map(async (rawSymbol) => {
    const symbol = rawSymbol.trim().toUpperCase();
    const response = await fetcher(historyUrl, {
      body: JSON.stringify({ dil: "TR", fonKodu: symbol, periyod: lookbackMonths }),
      headers: requestHeaders,
      method: "POST",
    });
    if (response.status === 429 || response.status >= 500) {
      throw new Error(`TEFAS temporarily unavailable (${response.status})`);
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
  if (failedSymbols.length === symbols.length) throw new Error("TEFAS fund price batch failed");
  return { failedSymbols, points };
}
