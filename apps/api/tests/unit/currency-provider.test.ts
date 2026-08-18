import { describe, expect, it } from "vitest";

import { parseTcmbBulletin } from "../../src/modules/currency/currency.provider";

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
