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

function shiftDate(dateIso: string, deltaDays: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + deltaDays);
  return date.toISOString().slice(0, 10);
}

const todayUrl = "https://www.tcmb.gov.tr/kurlar/today.xml";
const maxCarryDays = 7;

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
  now: Date = new Date(),
): Promise<CurrencyRateBulletin | null> {
  if (targetDate === now.toISOString().slice(0, 10)) {
    // TCMB only adds the current business day to its dated archive after
    // the fact - same-day rates are published solely via this "today.xml"
    // alias. An explicit request for today accepts whatever it currently
    // shows outright (even the still-yesterday rate before today's own
    // bulletin is out), since that is the best available TRY figure for
    // "right now" either way.
    const live = await fetchBulletin(todayUrl, fetcher);
    if (live !== "MISSING") return live;
  }

  // The exact requested date's archive, then the closest prior business
  // day carried backward - a Friday close is treated as still current
  // through the weekend, and the same applies to any holiday in between.
  // Capped at maxCarryDays: some holiday blocks run 9+ days, and this is
  // left to run out for the tail of those rather than reaching arbitrarily
  // far into the past for a stand-in number.
  for (let offset = 0; offset <= maxCarryDays; offset++) {
    const result = await fetchBulletin(datedUrl(shiftDate(targetDate, -offset)), fetcher);
    if (result !== "MISSING") return result;
  }
  return null;
}
