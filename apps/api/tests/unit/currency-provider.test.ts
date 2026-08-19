import { describe, expect, it, vi } from "vitest";

import { fetchTcmbRates, parseTcmbBulletin } from "../../src/modules/currency/currency.provider";

function bulletin(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="isokur.xsl"?>
<Tarih_Date Tarih="18.08.2026" Date="08/18/2026"  Bulten_No="2026/153" >
${body}
</Tarih_Date>`;
}

describe("TCMB currency rate bulletin parsing", () => {
  it("reads the bulletin date and each currency's forex buying rate", () => {
    const xml = bulletin(`
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">
      <Unit>1</Unit>
      <Isim>ABD DOLARI</Isim>
      <CurrencyName>US DOLLAR</CurrencyName>
      <ForexBuying>47.8293</ForexBuying>
      <ForexSelling>47.9155</ForexSelling>
      <BanknoteBuying>47.7958</BanknoteBuying>
      <BanknoteSelling>47.9873</BanknoteSelling>
      <CrossRateUSD/>
      <CrossRateOther/>
  </Currency>
  <Currency CrossOrder="9" Kod="EUR" CurrencyCode="EUR">
      <Unit>1</Unit>
      <Isim>EURO</Isim>
      <CurrencyName>EURO</CurrencyName>
      <ForexBuying>55.3660</ForexBuying>
      <ForexSelling>55.4658</ForexSelling>
      <BanknoteBuying>55.3273</BanknoteBuying>
      <BanknoteSelling>55.5490</BanknoteSelling>
        <CrossRateUSD/>
        <CrossRateOther>1.1576</CrossRateOther>
  </Currency>`);

    const result = parseTcmbBulletin(xml);
    expect(result?.rateDate).toBe("2026-08-18");
    expect(result?.points).toEqual([
      { currencyCode: "USD", tryRate: "47.8293" },
      { currencyCode: "EUR", tryRate: "55.3660" },
    ]);
  });

  it("skips a currency whose ForexBuying is empty instead of recording a zero rate", () => {
    // KZT's BanknoteBuying/Selling are genuinely empty on real TCMB bulletins,
    // confirming both self-closing and empty-paired tags occur in the wild.
    const xml = bulletin(`
  <Currency CrossOrder="22" Kod="KZT" CurrencyCode="KZT">
      <Unit>1</Unit>
      <Isim>KAZAKİSTAN TENGESİ</Isim>
      <CurrencyName>KAZAKHSTAN TENGE</CurrencyName>
      <ForexBuying></ForexBuying>
      <ForexSelling>0.10453</ForexSelling>
      <BanknoteBuying></BanknoteBuying>
      <BanknoteSelling></BanknoteSelling>
        <CrossRateUSD>460.96</CrossRateUSD>
        <CrossRateOther/>
  </Currency>
  <Currency CrossOrder="0" Kod="XDR" CurrencyCode="XDR">
      <ForexBuying/>
  </Currency>`);

    expect(parseTcmbBulletin(xml)?.points).toEqual([]);
  });

  it("keeps only the first block for a duplicated currency code", () => {
    const xml = bulletin(`
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD"><ForexBuying>47.8293</ForexBuying></Currency>
  <Currency CrossOrder="1" Kod="USD" CurrencyCode="USD"><ForexBuying>999</ForexBuying></Currency>`);

    expect(parseTcmbBulletin(xml)?.points).toEqual([{ currencyCode: "USD", tryRate: "47.8293" }]);
  });

  it("returns null for a response with no bulletin date, e.g. an unexpected error page", () => {
    expect(parseTcmbBulletin("<html><body>Not Found</body></html>")).toBeNull();
  });
});

function bulletinFor(dateIso: string): string {
  const [year, month, day] = dateIso.split("-");
  return `<?xml version="1.0" encoding="UTF-8"?>
<Tarih_Date Tarih="${day}.${month}.${year}" Date="${month}/${day}/${year}" Bulten_No="2026/1">
  <Currency CrossOrder="0" Kod="USD" CurrencyCode="USD"><ForexBuying>47.8293</ForexBuying></Currency>
</Tarih_Date>`;
}

// Regression coverage for a bug where TCMB's dated archive URL (used for every
// request, including "today") 404s until the current business day is archived
// - which can be hours after TCMB actually publishes it live via today.xml, or
// the whole rest of the day. That made same-day rate syncs permanently unable
// to find data, no matter how many times "TCMB kurlarını güncelle" was clicked.
describe("fetchTcmbRates", () => {
  it("uses the dated archive URL directly when it has the bulletin, without touching today.xml", async () => {
    const fetcher = vi.fn(async () => new Response(bulletinFor("2026-08-18"), { status: 200 })) as typeof fetch;

    const result = await fetchTcmbRates("2026-08-18", fetcher);

    expect(result?.rateDate).toBe("2026-08-18");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to today.xml when the dated archive 404s and its date matches what was requested", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("today.xml")) return new Response(bulletinFor("2026-08-19"), { status: 200 });
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const result = await fetchTcmbRates("2026-08-19", fetcher);

    expect(result?.rateDate).toBe("2026-08-19");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("does not mislabel a stale today.xml (still showing yesterday) as the requested date", async () => {
    // today.xml keeps serving the last published bulletin until TCMB updates it,
    // so at e.g. 10:00 it may still show yesterday's date while a same-day sync
    // for "today" is attempted. That must read as "no data yet", not a match.
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("today.xml")) return new Response(bulletinFor("2026-08-18"), { status: 200 });
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const result = await fetchTcmbRates("2026-08-19", fetcher);

    expect(result).toBeNull();
  });

  it("returns null when both the dated archive and today.xml have nothing (e.g. a weekend)", async () => {
    const fetcher = vi.fn(async () => new Response("Not Found", { status: 404 })) as typeof fetch;

    const result = await fetchTcmbRates("2026-08-22", fetcher);

    expect(result).toBeNull();
  });

  it("still throws on a genuine TCMB outage instead of silently falling back", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 503 })) as typeof fetch;

    await expect(fetchTcmbRates("2026-08-19", fetcher)).rejects.toThrow("TCMB temporarily unavailable");
  });
});
