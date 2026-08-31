export interface MarketCatalogItem {
  catalogSource: "KAP" | "NASDAQ_TRADER";
  currencyCode: "TRY" | "USD";
  exchangeCode: string;
  instrumentType: "EQUITY" | "ETF" | "OTHER";
  market: "BIST" | "US";
  name: string;
  providerSymbol: string;
}

export interface MarketPricePoint {
  adjustedClose: string | null;
  close: string;
  currencyCode: string;
  priceDate: string;
  providerSymbol: string;
}

export interface MarketSplitEvent {
  denominator: string;
  numerator: string;
  providerSymbol: string;
  splitDate: string;
}

const endpoints = {
  bistEquities: "https://www.kap.org.tr/tr/bist-sirketler",
  bistEtfs: "https://www.kap.org.tr/tr/YatirimFonlari/BYF",
  nasdaq: "https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqlisted.txt",
  otherUs: "https://www.nasdaqtrader.com/dynamic/SymDir/otherlisted.txt",
  yahooChart: "https://query1.finance.yahoo.com/v8/finance/chart",
} as const;

const requestHeaders = {
  Accept: "application/json,text/plain,text/html;q=0.9,*/*;q=0.8",
  "User-Agent": "DefterX/1.0 market-data",
};

async function responseText(url: string, fetcher: typeof fetch): Promise<string> {
  const response = await fetcher(url, { headers: requestHeaders });
  if (!response.ok) throw new Error(`Market data source returned ${response.status}`);
  return response.text();
}

function yahooSymbol(value: string): string {
  return value.trim().toUpperCase().replace(/\./g, "-");
}

// Matches market_symbols.name's CHECK (char_length(name) BETWEEN 1 AND 240).
// Nasdaq Trader in particular lists warrants/units/rights with long descriptive
// names that can exceed this; truncating keeps one bad row from failing the
// whole catalog batch insert instead of dropping the symbol.
const maxNameLength = 240;
function safeName(value: string): string {
  return value.slice(0, maxNameLength);
}

export function parseNasdaqCatalog(nasdaq: string, other: string): MarketCatalogItem[] {
  const items = new Map<string, MarketCatalogItem>();
  const parse = (text: string, listedOnNasdaq: boolean) => {
    const rows = text.replace(/\r/g, "").split("\n");
    const headers = rows.shift()?.split("|") ?? [];
    const symbolIndex = headers.indexOf(listedOnNasdaq ? "Symbol" : "ACT Symbol");
    const nameIndex = headers.indexOf("Security Name");
    const exchangeIndex = headers.indexOf("Exchange");
    const etfIndex = headers.indexOf("ETF");
    const testIndex = headers.indexOf("Test Issue");
    for (const row of rows) {
      if (!row || row.startsWith("File Creation Time")) continue;
      const values = row.split("|");
      if (values[testIndex] !== "N") continue;
      const rawSymbol = values[symbolIndex]?.trim();
      const name = values[nameIndex]?.trim();
      if (!rawSymbol || !name) continue;
      const providerSymbol = yahooSymbol(rawSymbol);
      if (!/^[A-Z0-9][A-Z0-9^-]{0,39}$/.test(providerSymbol)) continue;
      const exchange = listedOnNasdaq ? "NASDAQ" : ({ A: "NYSE_AMERICAN", N: "NYSE", P: "NYSE_ARCA", Z: "CBOE" }[values[exchangeIndex] ?? ""] ?? "US");
      items.set(providerSymbol, {
        catalogSource: "NASDAQ_TRADER",
        currencyCode: "USD",
        exchangeCode: exchange,
        instrumentType: values[etfIndex] === "Y" ? "ETF" : "EQUITY",
        market: "US",
        name: safeName(name),
        providerSymbol,
      });
    }
  };
  parse(nasdaq, true);
  parse(other, false);
  return [...items.values()];
}

function unescapeFlightHtml(html: string): string {
  return html.replace(/\\"/g, '"').replace(/\\u0026/g, "&");
}

export function parseKapEquities(html: string): MarketCatalogItem[] {
  const source = unescapeFlightHtml(html);
  const pattern = /"kapMemberTitle":"([^"]+)".{0,700}?"stockCode":"([^"]+)"/gs;
  const items = new Map<string, MarketCatalogItem>();
  for (const match of source.matchAll(pattern)) {
    // KAP lists dual/multi-listed companies (e.g. banks with a secondary
    // code) as a comma-separated stockCode like "GARAN, TGB" - splitting on
    // whitespace alone left a trailing comma on the primary code ("GARAN,"),
    // which failed the format check below and silently dropped the whole
    // company from the catalog.
    const code = match[2]?.trim().split(/[,\s]+/)[0]?.toUpperCase();
    const name = match[1]?.trim();
    if (!code || !name || !/^[A-Z0-9]{2,8}$/.test(code)) continue;
    const providerSymbol = `${code}.IS`;
    items.set(providerSymbol, {
      catalogSource: "KAP",
      currencyCode: "TRY",
      exchangeCode: "BIST",
      instrumentType: "EQUITY",
      market: "BIST",
      name: safeName(name),
      providerSymbol,
    });
  }
  return [...items.values()];
}

export function parseKapEtfs(html: string): MarketCatalogItem[] {
  const source = unescapeFlightHtml(html);
  const pattern = /"fundCode":"([^"]+)".{0,250}?"fundName":"([^"]+)".{0,250}?"fundType":"BYF"/gs;
  const items = new Map<string, MarketCatalogItem>();
  for (const match of source.matchAll(pattern)) {
    const code = match[1]?.trim().toUpperCase();
    const name = match[2]?.trim();
    if (!code || !name || !/^[A-Z0-9]{2,8}$/.test(code)) continue;
    const providerSymbol = `${code}.IS`;
    items.set(providerSymbol, {
      catalogSource: "KAP",
      currencyCode: "TRY",
      exchangeCode: "BIST",
      instrumentType: "ETF",
      market: "BIST",
      name: safeName(name),
      providerSymbol,
    });
  }
  return [...items.values()];
}

export async function fetchMarketCatalog(fetcher: typeof fetch = fetch): Promise<MarketCatalogItem[]> {
  const [nasdaq, other, bistEquities, bistEtfs] = await Promise.all([
    responseText(endpoints.nasdaq, fetcher),
    responseText(endpoints.otherUs, fetcher),
    responseText(endpoints.bistEquities, fetcher),
    responseText(endpoints.bistEtfs, fetcher),
  ]);
  return [
    ...parseNasdaqCatalog(nasdaq, other),
    ...parseKapEquities(bistEquities),
    ...parseKapEtfs(bistEtfs),
  ];
}

function decimal(value: unknown): string | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? String(value) : null;
}

function utcDate(timestamp: unknown): string | null {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return null;
  return new Date(timestamp * 1000).toISOString().slice(0, 10);
}

async function yahooJson(url: string, fetcher: typeof fetch): Promise<any> {
  const response = await fetcher(url, { headers: requestHeaders });
  if (response.status === 404) return null;
  if (response.status === 429 || response.status >= 500) {
    throw new Error(`Yahoo Finance temporarily unavailable (${response.status})`);
  }
  if (!response.ok) return null;
  return response.json();
}

function priceFromChartResult(result: any, providerSymbol: string, targetDate: string): MarketPricePoint | null {
  const timestamps: unknown[] = result?.timestamp ?? [];
  const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
  const adjusted: unknown[] = result?.indicators?.adjclose?.[0]?.adjclose ?? [];
  const index = timestamps.findIndex((timestamp) => utcDate(timestamp) === targetDate);
  if (index < 0) return null;
  const close = decimal(closes[index]);
  if (!close) return null;
  return {
    adjustedClose: decimal(adjusted[index]),
    close,
    currencyCode: String(result?.meta?.currency ?? (providerSymbol.endsWith(".IS") ? "TRY" : "USD")).slice(0, 3),
    priceDate: targetDate,
    providerSymbol,
  };
}

export async function fetchYahooPrices(
  symbols: readonly string[],
  targetDate: string,
  fetcher: typeof fetch = fetch,
): Promise<{ failedSymbols: string[]; points: MarketPricePoint[] }> {
  if (symbols.length === 0) return { failedSymbols: [], points: [] };
  // One chart request per symbol. We used to batch recent dates through the v7
  // /spark endpoint, but now that a run only covers the codes someone actually
  // tracks (not the ~13k-code catalog) the batching is unnecessary - and spark
  // had started returning nothing for BIST, which is why those prices stopped
  // updating. The window reaches a few days back so a non-trading targetDate
  // still lands inside a returned range (priceFromChartResult matches the exact
  // date, so the extra bars are harmless).
  const start = Math.floor(new Date(`${targetDate}T00:00:00Z`).getTime() / 1000) - 7 * 86_400;
  const end = Math.floor(new Date(`${targetDate}T00:00:00Z`).getTime() / 1000) + 2 * 86_400;
  const results = await Promise.allSettled(symbols.map(async (providerSymbol) => {
    const url = new URL(`${endpoints.yahooChart}/${encodeURIComponent(providerSymbol)}`);
    url.searchParams.set("period1", String(start));
    url.searchParams.set("period2", String(end));
    url.searchParams.set("interval", "1d");
    url.searchParams.set("events", "history");
    const payload = await yahooJson(url.toString(), fetcher);
    return priceFromChartResult(payload?.chart?.result?.[0], providerSymbol, targetDate);
  }));
  const points: MarketPricePoint[] = [];
  const failedSymbols: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") failedSymbols.push(symbols[index]!);
    else if (result.value) points.push(result.value);
  });
  if (failedSymbols.length === symbols.length) throw new Error("Yahoo Finance price batch failed");
  return { failedSymbols, points };
}

// The manual "update every price now" button wants a price on the screen
// immediately, not tomorrow's official close. This reads the current intraday
// quote (meta.regularMarketPrice) from the same chart endpoint and stamps it on
// targetDate unconditionally - there is no "is there a bar for this day?" filter
// like fetchYahooPrices has, so BIST codes get a value even mid-session or
// before Yahoo has published the daily bar.
export async function fetchYahooLivePrices(
  symbols: readonly string[],
  targetDate: string,
  fetcher: typeof fetch = fetch,
): Promise<{ failedSymbols: string[]; points: MarketPricePoint[] }> {
  if (symbols.length === 0) return { failedSymbols: [], points: [] };
  const results = await Promise.allSettled(symbols.map(async (providerSymbol) => {
    const url = new URL(`${endpoints.yahooChart}/${encodeURIComponent(providerSymbol)}`);
    url.searchParams.set("range", "1d");
    url.searchParams.set("interval", "1d");
    const payload = await yahooJson(url.toString(), fetcher);
    const meta = payload?.chart?.result?.[0]?.meta;
    const close = decimal(meta?.regularMarketPrice);
    if (!close) return null;
    return {
      adjustedClose: null,
      close,
      currencyCode: String(meta?.currency ?? (providerSymbol.endsWith(".IS") ? "TRY" : "USD")).slice(0, 3),
      priceDate: targetDate,
      providerSymbol,
    } satisfies MarketPricePoint;
  }));
  const points: MarketPricePoint[] = [];
  const failedSymbols: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "rejected") failedSymbols.push(symbols[index]!);
    else if (result.value) points.push(result.value);
  });
  if (failedSymbols.length === symbols.length) throw new Error("Yahoo Finance live price batch failed");
  return { failedSymbols, points };
}

export async function fetchYahooSplits(
  providerSymbol: string,
  fetcher: typeof fetch = fetch,
): Promise<MarketSplitEvent[]> {
  const url = new URL(`${endpoints.yahooChart}/${encodeURIComponent(providerSymbol)}`);
  url.searchParams.set("range", "1mo");
  url.searchParams.set("interval", "1d");
  url.searchParams.set("events", "splits");
  const payload = await yahooJson(url.toString(), fetcher);
  const splits = Object.values(payload?.chart?.result?.[0]?.events?.splits ?? {}) as any[];
  return splits.flatMap((split) => {
    const splitDate = utcDate(split?.date);
    const numerator = decimal(split?.numerator);
    const denominator = decimal(split?.denominator);
    return splitDate && numerator && denominator
      ? [{ denominator, numerator, providerSymbol, splitDate }]
      : [];
  });
}
