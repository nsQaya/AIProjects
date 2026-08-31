import { describe,expect,it,vi } from "vitest";

import {
  fetchYahooLivePrices,
  fetchYahooPrices,
  parseKapEquities,
  parseKapEtfs,
  parseNasdaqCatalog,
} from "../../src/modules/market-data/market-data.provider";

describe("market data provider", () => {
  it("parses Nasdaq, NYSE and ETF symbols while excluding test issues", () => {
    const nasdaq = [
      "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares",
      "AAPL|Apple Inc. Common Stock|Q|N|N|100|N|N",
      "QQQ|Invesco QQQ Trust|G|N|N|100|Y|N",
      "TEST|Test security|S|Y|N|100|N|N",
    ].join("\n");
    const other = [
      "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol",
      "BRK.B|Berkshire Hathaway Inc.|N|BRK.B|N|100|N|BRK.B",
    ].join("\n");

    expect(parseNasdaqCatalog(nasdaq,other)).toEqual(expect.arrayContaining([
      expect.objectContaining({providerSymbol:"AAPL",instrumentType:"EQUITY",exchangeCode:"NASDAQ"}),
      expect.objectContaining({providerSymbol:"QQQ",instrumentType:"ETF"}),
      expect.objectContaining({providerSymbol:"BRK-B",exchangeCode:"NYSE"}),
    ]));
    expect(parseNasdaqCatalog(nasdaq,other)).toHaveLength(3);
  });

  it("parses KAP equities and exchange-traded funds into Yahoo symbols", () => {
    const equityHtml = String.raw`\"kapMemberTitle\":\"BİM BİRLEŞİK MAĞAZALAR A.Ş.\",\"relatedMemberTitle\":\"X\",\"stockCode\":\"BIMAS\"`;
    const etfHtml = String.raw`\"fundCode\":\"GLDTR\",\"fundName\":\"ALTIN BORSA YATIRIM FONU\",\"fundType\":\"BYF\"`;
    expect(parseKapEquities(equityHtml)[0]).toMatchObject({providerSymbol:"BIMAS.IS",market:"BIST"});
    expect(parseKapEtfs(etfHtml)[0]).toMatchObject({providerSymbol:"GLDTR.IS",instrumentType:"ETF"});
  });

  it("takes the primary code from a dual-listed company's comma-separated stockCode", () => {
    const equityHtml = String.raw`\"kapMemberTitle\":\"TÜRKİYE GARANTİ BANKASI A.Ş.\",\"relatedMemberTitle\":\"X\",\"stockCode\":\"GARAN, TGB\"`;
    expect(parseKapEquities(equityHtml)[0]).toMatchObject({providerSymbol:"GARAN.IS",market:"BIST"});
  });

  it("truncates names past market_symbols' 240-character limit instead of failing the batch", () => {
    const longName = `Warrant to purchase common stock ${"X".repeat(220)}`;
    expect(longName.length).toBeGreaterThan(240);
    const nasdaq = [
      "Symbol|Security Name|Market Category|Test Issue|Financial Status|Round Lot Size|ETF|NextShares",
      `LONGW|${longName}|Q|N|N|100|N|N`,
    ].join("\n");
    const [item] = parseNasdaqCatalog(nasdaq, "ACT Symbol|Security Name|Exchange|CQS Symbol|ETF|Round Lot Size|Test Issue|NASDAQ Symbol");
    expect(item?.name).toHaveLength(240);
    expect(longName.startsWith(item!.name)).toBe(true);

    const equityHtml = String.raw`\"kapMemberTitle\":\"${"UZUN İSİM ".repeat(30)}A.Ş.\",\"relatedMemberTitle\":\"X\",\"stockCode\":\"UZUN\"`;
    expect(parseKapEquities(equityHtml)[0]?.name.length).toBeLessThanOrEqual(240);
  });

  it("returns only the requested trading day's positive close and tolerates missing symbols", async () => {
    const timestamp = Date.parse("2026-08-14T13:30:00Z") / 1000;
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const result = String(input).includes("AAPL")
        ? {meta:{currency:"USD"},timestamp:[timestamp],indicators:{quote:[{close:[123.45]}],adjclose:[{adjclose:[120]}]}}
        : {meta:{currency:"USD"},timestamp:[],indicators:{quote:[{close:[]}]}};
      return new Response(JSON.stringify({ chart: { result: [result] } }),{status:200,headers:{"Content-Type":"application/json"}});
    }) as typeof fetch;

    const result = await fetchYahooPrices(["AAPL","NEW"],"2026-08-14",fetcher);
    expect(result.points).toEqual([{
      providerSymbol:"AAPL",priceDate:"2026-08-14",close:"123.45",adjustedClose:"120",currencyCode:"USD",
    }]);
    expect(result.failedSymbols).toEqual([]);
  });

  it("stamps the live intraday quote on targetDate regardless of the bar dates it saw", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({
      chart: { result: [{ meta: { currency:"TRY", regularMarketPrice: 312.5 } }] },
    }),{status:200,headers:{"Content-Type":"application/json"}})) as typeof fetch;

    const result = await fetchYahooLivePrices(["THYAO.IS"],"2026-08-27",fetcher);
    expect(result.points).toEqual([{
      providerSymbol:"THYAO.IS",priceDate:"2026-08-27",close:"312.5",adjustedClose:null,currencyCode:"TRY",
    }]);
    expect(result.failedSymbols).toEqual([]);
  });
});
