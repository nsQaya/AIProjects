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

// Regression coverage for two related bugs:
// - fetchTcmbRates used to read TCMB's dated archive URL for every request,
//   including "today" - which does not get a dated entry until sometime
//   after the fact, so same-day syncs could never find data.
// - Weekends/holidays never get a bulletin at all, so requesting one used to
//   read as "no rate", even though the user expects the prior business day's
//   rate to still apply (a Friday close stands in through the weekend).
const NOW = new Date("2026-08-19T12:00:00.000Z"); // "today" = 2026-08-19

function urlsCalled(fetcher: typeof fetch): string[] {
  const mock = fetcher as unknown as ReturnType<typeof vi.fn>;
  return mock.mock.calls.map((call: unknown[]) => String(call[0]));
}

describe("fetchTcmbRates", () => {
  it("uses the exact requested date's dated archive directly, without touching today.xml", async () => {
    const fetcher = vi.fn(async () => new Response(bulletinFor("2026-08-18"), { status: 200 })) as typeof fetch;

    const result = await fetchTcmbRates("2026-08-18", fetcher, NOW);

    expect(result?.rateDate).toBe("2026-08-18");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("accepts today.xml outright when asked for today, even while it still shows yesterday's bulletin", async () => {
    // Before TCMB publishes today's rate (usually mid-afternoon), today.xml
    // keeps serving yesterday's bulletin - that is still the best available
    // TRY figure for "right now" and must be accepted, not rejected.
    const fetcher = vi.fn(async () => new Response(bulletinFor("2026-08-18"), { status: 200 })) as typeof fetch;

    const result = await fetchTcmbRates("2026-08-19", fetcher, NOW);

    expect(result?.points).toEqual([{ currencyCode: "USD", tryRate: "47.8293" }]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(urlsCalled(fetcher)[0]).toContain("today.xml");
  });

  it("falls back to the dated archive search when today.xml itself has nothing for a same-day request", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("today.xml")) return new Response("Not Found", { status: 404 });
      if (url.endsWith("19082026.xml")) return new Response("Not Found", { status: 404 });
      if (url.endsWith("18082026.xml")) return new Response(bulletinFor("2026-08-18"), { status: 200 });
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const result = await fetchTcmbRates("2026-08-19", fetcher, NOW);

    expect(result?.rateDate).toBe("2026-08-18");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("carries the closest prior business day's rate backward for a past weekend date", async () => {
    // Saturday 2026-08-15 has no bulletin of its own; Friday 2026-08-14's
    // rate should be treated as still current and returned for it.
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("14082026.xml")) return new Response(bulletinFor("2026-08-14"), { status: 200 });
      return new Response("Not Found", { status: 404 });
    }) as typeof fetch;

    const result = await fetchTcmbRates("2026-08-15", fetcher, NOW);

    expect(result?.rateDate).toBe("2026-08-14");
    expect(urlsCalled(fetcher)).toEqual([
      expect.stringContaining("15082026.xml"),
      expect.stringContaining("14082026.xml"),
    ]);
  });

  it("gives up after 7 days back instead of reaching further, e.g. a long holiday block", async () => {
    const fetcher = vi.fn(async () => new Response("Not Found", { status: 404 })) as typeof fetch;

    const result = await fetchTcmbRates("2026-08-15", fetcher, NOW);

    expect(result).toBeNull();
    // 2026-08-15 down through 2026-08-08 inclusive: 8 probes, not a 9th.
    expect(fetcher).toHaveBeenCalledTimes(8);
    expect(urlsCalled(fetcher).at(-1)).toContain("08082026.xml");
  });

  it("still throws on a genuine TCMB outage instead of silently carrying forward", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 503 })) as typeof fetch;

    await expect(fetchTcmbRates("2026-08-15", fetcher, NOW)).rejects.toThrow("TCMB temporarily unavailable");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
