import type { ReportAnalyticsResponse } from "@defterx/contracts";

import { money, moneyInCurrency, toNumber } from "../../lib/format";
import type { ExportCell, ExportTable } from "../../lib/table-export";
import {
  accountValueSeries,
  comparisonChange,
  instrumentPriceSeries,
  type ComparisonSelection,
} from "./report-chart-options";

export function reportDate(value: string): string {
  return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium" }).format(new Date(value));
}

/** Context lines shown under each exported table's title. */
export function reportPeriodMeta(from: string, to: string, accountSummary: string): string[] {
  return [`${reportDate(from)} – ${reportDate(to)}`, accountSummary];
}

/** A TRY money cell: a real number for Excel, the formatted string for PDF. */
function tl(raw: string | number | null | undefined): ExportCell {
  const value = toNumber(raw ?? 0);
  return { value, text: money(value) };
}

/** Like `tl`, but a null base-currency value (no FX rate yet) stays as a note. */
function tlOrNote(raw: string | null, note: string): ExportCell {
  return raw === null ? note : tl(raw);
}

type NetWorth = ReportAnalyticsResponse["netWorth"];
type AccountBalances = ReportAnalyticsResponse["accountBalances"];
type Liquidity = ReportAnalyticsResponse["liquidity"];
type DrillTransactions = ReportAnalyticsResponse["categoryDetail"]["transactions"];
type InstrumentComparison = ReportAnalyticsResponse["instrumentComparison"];

function boundCell(value: number | null, currency: string): ExportCell {
  return value === null ? "—" : { value, text: moneyInCurrency(value, currency) };
}

function changeCell(change: number | null): ExportCell {
  return change === null ? "—" : { value: change, text: `%${change.toFixed(2)}` };
}

export function instrumentComparisonTable(
  comparison: InstrumentComparison,
  selection: ComparisonSelection,
  meta: string[],
): ExportTable {
  const accountName = new Map(comparison.accounts.map((account) => [account.accountId, account.name]));
  const instrumentById = new Map(comparison.instruments.map((instrument) => [instrument.instrumentId, instrument]));

  const accountRows = selection.accountIds
    .filter((accountId) => accountName.has(accountId))
    .map((accountId) => {
      const { first, last, change } = comparisonChange(accountValueSeries(comparison, accountId));
      return [
        accountName.get(accountId)!,
        "Hesap yekünü",
        boundCell(first, "TRY"),
        boundCell(last, "TRY"),
        changeCell(change),
      ] satisfies ExportCell[];
    });

  const instrumentRows = selection.instrumentIds
    .map((instrumentId) => instrumentById.get(instrumentId))
    .filter((instrument): instrument is NonNullable<typeof instrument> => Boolean(instrument))
    .map((instrument) => {
      const { first, last, change } = comparisonChange(instrumentPriceSeries(comparison, instrument.instrumentId));
      return [
        instrument.symbol ? `${instrument.name} (${instrument.symbol})` : instrument.name,
        instrument.assetTypeName,
        boundCell(first, instrument.currencyCode),
        boundCell(last, instrument.currencyCode),
        changeCell(change),
      ] satisfies ExportCell[];
    });

  return {
    title: "Varlık Değişim Karşılaştırması",
    meta,
    columns: [
      { header: "Seri" },
      { header: "Tür" },
      { header: "Başlangıç", align: "right" },
      { header: "Son", align: "right" },
      { header: "Değişim", align: "right" },
    ],
    rows: [...accountRows, ...instrumentRows],
  };
}

export function netWorthPerformanceTable(netWorth: NetWorth, meta: string[]): ExportTable {
  return {
    title: "Yatırım Performansı",
    meta,
    columns: [
      { header: "Varlık" },
      { header: "Döviz" },
      { header: "Maliyet (₺)", align: "right" },
      { header: "Güncel değer (₺)", align: "right" },
      { header: "Gerçekleşen (₺)", align: "right" },
      { header: "Gerçekleşmemiş (₺)", align: "right" },
      { header: "Toplam (₺)", align: "right" },
    ],
    rows: netWorth.items.map((item) => {
      const cost = toNumber(item.costBasisTRY ?? "0");
      const unrealized = item.unrealizedGainTRY === null ? 0 : toNumber(item.unrealizedGainTRY);
      return [
        item.symbol ? `${item.name} (${item.symbol})` : item.name,
        item.currencyCode,
        tlOrNote(item.costBasisTRY, "kur yok"),
        item.currentValue === null ? "Fiyat yok" : tlOrNote(item.currentValueTRY, "kur yok"),
        tlOrNote(item.realizedGainTRY, "kur yok"),
        item.unrealizedGain === null ? "—" : tlOrNote(item.unrealizedGainTRY, "kur yok"),
        tl(cost + unrealized),
      ];
    }),
    totalRow: netWorth.items.length > 0
      ? [
          "TOPLAM",
          "",
          tl(netWorth.investmentCost),
          tl(netWorth.investmentValue),
          tl(netWorth.realizedGain),
          tl(netWorth.unrealizedGain),
          tl(toNumber(netWorth.investmentCost) + toNumber(netWorth.unrealizedGain)),
        ]
      : undefined,
  };
}

export function accountBalancesTable(balances: AccountBalances, meta: string[]): ExportTable {
  return {
    title: "Hesap Bakiyeleri",
    meta,
    columns: [{ header: "Hesap" }, { header: "Son bakiye (₺)", align: "right" }],
    rows: balances.accounts.map((account) => {
      const latest = balances.items.filter((item) => item.accountId === account.id).at(-1);
      return [account.name, tl(latest?.balance ?? 0)];
    }),
  };
}

export function liquidityEventsTable(liquidity: Liquidity, meta: string[]): ExportTable {
  return {
    title: "Likidite — İşlemler ve Planlar",
    meta,
    columns: [
      { header: "Tarih" },
      { header: "İşlem" },
      { header: "Tür" },
      { header: "Durum" },
      { header: "Etki (₺)", align: "right" },
    ],
    rows: liquidity.events.map((event) => [
      reportDate(event.scheduledAt),
      event.title,
      event.type,
      event.realized ? "Gerçekleşen" : "Planlı",
      tl(event.impact),
    ]),
  };
}

export function categoryDetailTable(transactions: DrillTransactions, meta: string[]): ExportTable {
  return {
    title: "Kategori Detayı — İşlemler",
    meta,
    columns: [
      { header: "Tarih" },
      { header: "İşlem" },
      { header: "Kategori" },
      { header: "Masraf merkezi" },
      { header: "Hesap" },
      { header: "Tutar (₺)", align: "right" },
    ],
    rows: transactions.map((transaction) => [
      reportDate(transaction.transactionDate),
      transaction.title,
      transaction.categoryName ?? "—",
      transaction.costCenterName ?? "—",
      transaction.accountName ?? "—",
      tl(transaction.amount),
    ]),
  };
}
