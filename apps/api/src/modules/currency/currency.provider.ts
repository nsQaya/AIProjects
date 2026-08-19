export interface CurrencyRatePoint {
  currencyCode: string;
  tryRate: string;
}

export interface CurrencyRateBulletin {
  rateDate: string;
  points: CurrencyRatePoint[];
}

function datedUrl(date: string): string {
  const [year, month, day] = date.split("-");
  return `https://www.tcmb.gov.tr/kurlar/${year}${month}/${day}${month}${year}.xml`;
}

const todayUrl = "https://www.tcmb.gov.tr/kurlar/today.xml";

const requestHeaders = {
  Accept: "application/xml,text/xml;q=0.9,*/*;q=0.8",
  "User-Agent": "DefterX/1.0 currency-rates",
};

/**
 * TCMB publishes one bulletin per business day at a fixed URL (today.xml) and,
 * for past dates, at /kurlar/{YYYYMM}/{DDMMYYYY}.xml. Weekends/holidays 404 —
 * that is not an error, it means no bulletin exists for that date.
 */
export function parseTcmbBulletin(xml: string): CurrencyRateBulletin | null {
  const dateMatch = xml.match(/<Tarih_Date\b[^>]*\bDate="(\d{2})\/(\d{2})\/(\d{4})"/);
  if (!dateMatch) return null;
  const [, month, day, year] = dateMatch;
  const rateDate = `${year}-${month}-${day}`;
  const points: CurrencyRatePoint[] = [];
  const seen = new Set<string>();
  const blockPattern = /<Currency\b[^>]*\bKod="([A-Z]{3})"[^>]*>([\s\S]*?)<\/Currency>/g;
  for (const match of xml.matchAll(blockPattern)) {
    const currencyCode = match[1]!;
    if (seen.has(currencyCode)) continue;
    const rateMatch = match[2]!.match(/<ForexBuying>([0-9]+(?:\.[0-9]+)?)<\/ForexBuying>/);
    const tryRate = rateMatch?.[1];
    if (!tryRate || Number(tryRate) <= 0) continue;
    seen.add(currencyCode);
    points.push({ currencyCode, tryRate });
  }
  return { rateDate, points };
}

async function fetchBulletin(url: string, fetcher: typeof fetch): Promise<CurrencyRateBulletin | null | "MISSING"> {
  const response = await fetcher(url, { headers: requestHeaders });
  if (response.status === 404) return "MISSING";
  if (response.status === 429 || response.status >= 500) {
    throw new Error(`TCMB temporarily unavailable (${response.status})`);
  }
  if (!response.ok) return null;
  return parseTcmbBulletin(await response.text());
}

export async function fetchTcmbRates(
  targetDate: string,
  fetcher: typeof fetch = fetch,
): Promise<CurrencyRateBulletin | null> {
  const dated = await fetchBulletin(datedUrl(targetDate), fetcher);
  if (dated !== "MISSING") return dated;

  // TCMB only adds the current business day to its dated archive after the
  // fact - same-day rates are published solely via this "today.xml" alias
  // (which keeps showing the last published day's rate until the next
  // bulletin is out). Fall back to it, but only trust the result when its
  // own embedded date actually matches what was requested, so a 404 for an
  // unrelated (e.g. past/weekend) date never gets silently mislabeled with
  // today's rate.
  const live = await fetchBulletin(todayUrl, fetcher);
  if (live === "MISSING" || live === null) return null;
  return live.rateDate === targetDate ? live : null;
}
