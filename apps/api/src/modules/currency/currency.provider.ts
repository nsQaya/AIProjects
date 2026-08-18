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

export async function fetchTcmbRates(
  targetDate: string,
  fetcher: typeof fetch = fetch,
): Promise<CurrencyRateBulletin | null> {
  const response = await fetcher(datedUrl(targetDate), { headers: requestHeaders });
  if (response.status === 404) return null;
  if (response.status === 429 || response.status >= 500) {
    throw new Error(`TCMB temporarily unavailable (${response.status})`);
  }
  if (!response.ok) return null;
  return parseTcmbBulletin(await response.text());
}
