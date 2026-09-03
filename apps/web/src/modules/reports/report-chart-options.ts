import type { ReportAnalyticsResponse } from "@defterx/contracts";
import type { ReportChartOption } from "../../components/charts";
import { money, shortMoney } from "../../lib/format";

export const reportChartColors = [
  "#287b60",
  "#d6a448",
  "#456fa9",
  "#a95b54",
  "#7b68a6",
  "#6f8d83",
  "#b77c3a",
] as const;

export interface DistributionChartRow {
  amount: number;
  name: string;
}

export function categoryDistributionOption(
  rows: readonly DistributionChartRow[],
  total: number,
): ReportChartOption {
  return {
    animationDuration: 350,
    aria: {
      enabled: true,
      decal: { show: true },
      description: `Kategori bazında toplam gider ${money(total)}.`,
    },
    color: [...reportChartColors],
    title: {
      text: money(total),
      subtext: "Toplam gider",
      left: "center",
      top: "40%",
      textStyle: { color: "#1c2924", fontFamily: "Georgia, serif", fontSize: 19 },
      subtextStyle: { color: "#75827c", fontSize: 10 },
    },
    tooltip: {
      trigger: "item",
      valueFormatter: (value) => money(Number(value)),
    },
    series: [
      {
        name: "Kategori gideri",
        type: "pie",
        radius: ["58%", "82%"],
        center: ["50%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#ffffff", borderWidth: 3, borderRadius: 5 },
        label: { show: false },
        emphasis: { scaleSize: 6 },
        data: rows.map((row) => ({ name: row.name, value: row.amount })),
      },
    ],
  };
}

export function costCenterDistributionOption(
  rows: readonly DistributionChartRow[],
): ReportChartOption {
  return {
    animationDuration: 350,
    aria: {
      enabled: true,
      decal: { show: true },
      description: "Masraf merkezi bazında gider dağılımı.",
    },
    color: [...reportChartColors],
    grid: { left: 8, right: 18, top: 8, bottom: 12, containLabel: true },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (value) => money(Number(value)),
    },
    xAxis: {
      type: "value",
      axisLabel: { color: "#75827c", formatter: (value: number) => shortMoney(value) },
      axisLine: { show: false },
      splitLine: { lineStyle: { color: "#e8ece9" } },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: rows.map((row) => row.name),
      axisLabel: { color: "#4d5b55", width: 130, overflow: "truncate" },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        name: "Gider",
        type: "bar",
        barMaxWidth: 22,
        data: rows.map((row, index) => ({
          value: row.amount,
          itemStyle: {
            color: reportChartColors[index % reportChartColors.length],
            borderRadius: [0, 6, 6, 0],
          },
        })),
      },
    ],
  };
}

function seriesTooltip(): ReportChartOption["tooltip"] {
  return {
    trigger: "axis",
    axisPointer: { type: "cross" },
    valueFormatter: (value) => money(Number(value)),
  };
}

export function trendOption(
  items: ReportAnalyticsResponse["trend"],
): ReportChartOption {
  return {
    animationDuration: 350,
    aria: { enabled: true, decal: { show: true }, description: "Gelir, gider ve net nakit akışı eğilimi." },
    color: ["#287b60", "#d6a448", "#456fa9"],
    legend: { bottom: 0, data: ["Gelir", "Gider", "Net"] },
    tooltip: seriesTooltip(),
    grid: { left: 18, right: 18, top: 20, bottom: 46, containLabel: true },
    xAxis: {
      type: "category",
      data: items.map((item) => item.period),
      axisLine: { lineStyle: { color: "#dce3df" } },
      axisLabel: { color: "#75827c", hideOverlap: true },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#75827c", formatter: (value: number) => shortMoney(value) },
      splitLine: { lineStyle: { color: "#e8ece9" } },
    },
    series: [
      { name: "Gelir", type: "bar", barMaxWidth: 24, data: items.map((item) => Number(item.income)) },
      { name: "Gider", type: "bar", barMaxWidth: 24, data: items.map((item) => Number(item.expense)) },
      { name: "Net", type: "line", smooth: true, symbolSize: 7, lineStyle: { width: 3 }, data: items.map((item) => Number(item.net)) },
    ],
  };
}

export function accountBalanceOption(
  report: ReportAnalyticsResponse["accountBalances"],
): ReportChartOption {
  const periods = [...new Map(report.items.map((item) => [item.periodStart, item.period])).values()];
  return {
    animationDuration: 350,
    aria: { enabled: true, decal: { show: true }, description: "Seçilen hesapların dönem sonu bakiye gelişimi." },
    color: [...reportChartColors],
    legend: { bottom: 0, type: "scroll" },
    tooltip: seriesTooltip(),
    grid: { left: 18, right: 18, top: 20, bottom: 52, containLabel: true },
    xAxis: { type: "category", data: periods, axisLabel: { color: "#75827c", hideOverlap: true } },
    yAxis: {
      type: "value",
      axisLabel: { color: "#75827c", formatter: (value: number) => shortMoney(value) },
      splitLine: { lineStyle: { color: "#e8ece9" } },
    },
    series: report.accounts.map((account) => ({
      name: account.name,
      type: "line" as const,
      smooth: true,
      showSymbol: report.items.length < 80,
      data: report.items.filter((item) => item.accountId === account.id).map((item) => Number(item.balance)),
    })),
  };
}

export function liquidityOption(
  items: ReportAnalyticsResponse["liquidity"]["items"],
): ReportChartOption {
  return {
    animationDuration: 350,
    aria: { enabled: true, decal: { show: true }, description: "Gerçekleşen ve planlı işlemlere göre tahmini nakit bakiyesi." },
    color: ["#287b60", "#d6a448", "#456fa9"],
    legend: { bottom: 0, data: ["Giriş", "Çıkış", "Tahmini bakiye"] },
    tooltip: seriesTooltip(),
    grid: { left: 18, right: 18, top: 20, bottom: 48, containLabel: true },
    xAxis: { type: "category", data: items.map((item) => item.period), axisLabel: { color: "#75827c", hideOverlap: true } },
    yAxis: {
      type: "value",
      axisLabel: { color: "#75827c", formatter: (value: number) => shortMoney(value) },
      splitLine: { lineStyle: { color: "#e8ece9" } },
    },
    series: [
      { name: "Giriş", type: "bar", stack: "flow", barMaxWidth: 24, data: items.map((item) => Number(item.inflow)) },
      { name: "Çıkış", type: "bar", stack: "flow", barMaxWidth: 24, data: items.map((item) => -Number(item.outflow)) },
      { name: "Tahmini bakiye", type: "line", smooth: true, symbolSize: 7, lineStyle: { width: 3 }, data: items.map((item) => Number(item.projectedBalance)) },
    ],
  };
}

type Comparison = ReportAnalyticsResponse["instrumentComparison"];

export interface ComparisonSelection {
  accountIds: readonly string[];
  instrumentIds: readonly string[];
}

type SeriesPoint = { periodStart: string; value: number | null };

/** One account's total-holding-value series, oldest bucket first. */
export function accountValueSeries(comparison: Comparison, accountId: string): SeriesPoint[] {
  return comparison.accountPoints
    .filter((point) => point.accountId === accountId)
    .map((point) => ({ periodStart: point.periodStart, value: Number(point.value) }))
    .sort((left, right) => (left.periodStart < right.periodStart ? -1 : 1));
}

/** One instrument's unit-price series (native currency), oldest bucket first. */
export function instrumentPriceSeries(comparison: Comparison, instrumentId: string): SeriesPoint[] {
  return comparison.instrumentPoints
    .filter((point) => point.instrumentId === instrumentId)
    .map((point) => ({ periodStart: point.periodStart, value: point.price === null ? null : Number(point.price) }))
    .sort((left, right) => (left.periodStart < right.periodStart ? -1 : 1));
}

/** First & last known value of a series and the % change between them (rebasing anchor). */
export function comparisonChange(points: readonly SeriesPoint[]): {
  first: number | null;
  last: number | null;
  change: number | null;
} {
  const known = points.filter((point) => point.value !== null) as Array<{ periodStart: string; value: number }>;
  const first = known[0]?.value ?? null;
  const last = known.at(-1)?.value ?? null;
  const change = first !== null && last !== null && first > 0
    ? Math.round(((last - first) / first) * 10_000) / 100
    : null;
  return { first, last, change };
}

/**
 * Overlays the selected accounts (total holding value) and instruments (unit
 * price) as lines rebased to 0% at each line's first known value, so series in
 * different currencies and magnitudes stay comparable (fintables-style).
 */
export function instrumentComparisonOption(
  comparison: Comparison,
  selection: ComparisonSelection,
): ReportChartOption {
  const periodPairs = [...new Map<string, string>([
    ...comparison.accountPoints.map((point) => [point.periodStart, point.period] as const),
    ...comparison.instrumentPoints.map((point) => [point.periodStart, point.period] as const),
  ])].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  const periodKeys = periodPairs.map(([start]) => start);
  const labels = periodPairs.map(([, label]) => label);

  const accountName = new Map(comparison.accounts.map((account) => [account.accountId, account.name]));
  const instrumentById = new Map(comparison.instruments.map((instrument) => [instrument.instrumentId, instrument]));

  const built: Array<{ name: string; currency: string; raw: Map<string, number | null> }> = [];
  for (const accountId of selection.accountIds) {
    const name = accountName.get(accountId);
    if (!name) continue;
    built.push({
      name,
      currency: "TRY",
      raw: new Map(accountValueSeries(comparison, accountId).map((point) => [point.periodStart, point.value])),
    });
  }
  for (const instrumentId of selection.instrumentIds) {
    const instrument = instrumentById.get(instrumentId);
    if (!instrument) continue;
    built.push({
      name: instrument.symbol || instrument.name,
      currency: instrument.currencyCode,
      raw: new Map(instrumentPriceSeries(comparison, instrumentId).map((point) => [point.periodStart, point.value])),
    });
  }

  const series = built.map((entry) => {
    const values = periodKeys.map((key) => entry.raw.get(key) ?? null);
    const base = values.find((value): value is number => value !== null && value > 0);
    return {
      name: entry.name,
      type: "line" as const,
      smooth: true,
      showSymbol: labels.length < 40,
      connectNulls: false,
      data: values.map((value) =>
        value === null || base === undefined ? null : Math.round(((value - base) / base) * 10_000) / 100),
    };
  });

  return {
    animationDuration: 350,
    aria: {
      enabled: true,
      description: "Seçilen hesap ve yatırım araçlarının dönem başına göre yüzde değişimi.",
    },
    color: [...reportChartColors],
    legend: { bottom: 0, type: "scroll" },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      valueFormatter: (value) =>
        value === null || value === undefined ? "—" : `%${Number(value).toFixed(2)}`,
    },
    grid: { left: 18, right: 18, top: 20, bottom: 52, containLabel: true },
    xAxis: { type: "category", data: labels, axisLabel: { color: "#75827c", hideOverlap: true } },
    yAxis: {
      type: "value",
      axisLabel: { color: "#75827c", formatter: (value: number) => `%${value}` },
      splitLine: { lineStyle: { color: "#e8ece9" } },
    },
    series,
  };
}

export interface AssetTreeNode {
  name: string;
  value: number;
  itemStyle?: { color?: string };
  children?: AssetTreeNode[];
}

// Solid, distinct shades per branch — greens for cash, blues for investments.
const CASH_SHADES = ["#2f855a", "#3f9c6f", "#54ac80", "#6cbd96", "#8bcfae"] as const;
const INVEST_SHADES = ["#3a6ba8", "#4f80bd", "#6b98cd", "#8bb1db", "#aac8e7"] as const;
const CASH_ROOT = "#215f43";
const INVEST_ROOT = "#2c5688";

/**
 * Builds the net-worth hierarchy the chart renders:
 *   Görünen varlık
 *     ├─ Nakit ─ {hesap türü} ─ {hesap}
 *     └─ Yatırım ─ {varlık türü} ─ {enstrüman}
 * Only positive contributors are charted; net debt from negative accounts is
 * reported separately by the caller.
 */
export function netWorthBreakdown(netWorth: ReportAnalyticsResponse["netWorth"]): {
  nodes: AssetTreeNode[];
  charted: number;
  debt: number;
} {
  type Group = { name: string; value: number; children: AssetTreeNode[] };
  const bucket = (map: Map<string, Group>, key: string): Group => {
    let group = map.get(key);
    if (!group) {
      group = { name: key, value: 0, children: [] };
      map.set(key, group);
    }
    return group;
  };

  const cashTypes = new Map<string, Group>();
  let debt = 0;
  for (const account of netWorth.cashAccounts) {
    const value = Number(account.balanceTry);
    if (value < 0) {
      debt += value;
      continue;
    }
    if (value === 0) continue;
    const group = bucket(cashTypes, account.accountTypeName);
    group.value += value;
    group.children.push({ name: account.name, value });
  }

  const investmentTypes = new Map<string, Group>();
  for (const item of netWorth.items) {
    const value = Number(item.currentValueTRY ?? item.costBasisTRY ?? "0");
    if (value <= 0) continue;
    const group = bucket(investmentTypes, item.assetTypeName);
    group.value += value;
    group.children.push({ name: item.symbol || item.name, value });
  }

  const paint = (groups: Group[], shades: readonly string[]): AssetTreeNode[] =>
    [...groups]
      .sort((left, right) => right.value - left.value)
      .map((group, index) => {
        const color = shades[index % shades.length];
        return {
          name: group.name,
          value: group.value,
          itemStyle: { color },
          children: [...group.children]
            .sort((a, b) => b.value - a.value)
            .map((child) => ({ ...child, itemStyle: { color } })),
        };
      });

  const cashChildren = paint([...cashTypes.values()], CASH_SHADES);
  const investmentChildren = paint([...investmentTypes.values()], INVEST_SHADES);
  const cashTotal = cashChildren.reduce((sum, node) => sum + node.value, 0);
  const investmentTotal = investmentChildren.reduce((sum, node) => sum + node.value, 0);

  const nodes: AssetTreeNode[] = [];
  if (cashTotal > 0) {
    nodes.push({ name: "Nakit", value: cashTotal, itemStyle: { color: CASH_ROOT }, children: cashChildren });
  }
  if (investmentTotal > 0) {
    nodes.push({ name: "Yatırım", value: investmentTotal, itemStyle: { color: INVEST_ROOT }, children: investmentChildren });
  }
  return { nodes, charted: cashTotal + investmentTotal, debt };
}

export function netWorthTreemapOption(
  netWorth: ReportAnalyticsResponse["netWorth"],
): ReportChartOption {
  const { nodes, charted } = netWorthBreakdown(netWorth);
  return {
    animationDuration: 320,
    aria: {
      enabled: true,
      description: `Toplam varlığın nakit ve yatırım kırılımı. Görünen varlık ${money(charted)}.`,
    },
    tooltip: {
      trigger: "item",
      formatter: (params) => {
        const info = params as { name?: string; value?: number; treePathInfo?: Array<{ name: string }> };
        const path = (info.treePathInfo ?? [])
          .slice(1)
          .map((node) => node.name)
          .filter(Boolean)
          .join(" › ");
        const share = charted > 0 ? ` · %${Math.round(((info.value ?? 0) / charted) * 100)}` : "";
        return `${path || info.name || ""}<br/><b>${money(Number(info.value ?? 0))}</b>${share}`;
      },
    },
    series: [
      {
        name: "Varlık",
        type: "treemap",
        top: 6,
        left: 6,
        right: 6,
        bottom: 26,
        roam: false,
        nodeClick: "zoomToNode",
        leafDepth: 2,
        visibleMin: Math.max(1, charted * 0.004),
        breadcrumb: {
          show: true,
          bottom: 2,
          height: 20,
          emptyItemWidth: 22,
          itemStyle: { color: "#eef3f0", borderColor: "#dbe5e0", borderWidth: 1, textStyle: { color: "#4d5b55", fontSize: 10 } },
          emphasis: { itemStyle: { color: "#dce9e2" } },
        },
        label: {
          show: true,
          overflow: "truncate",
          formatter: (params) => {
            const info = params as { name?: string; value?: number };
            return `{n|${info.name ?? ""}}\n{v|${shortMoney(Number(info.value ?? 0))}}`;
          },
          rich: {
            n: { fontSize: 11, fontWeight: 600, color: "#ffffff", lineHeight: 15 },
            v: { fontSize: 9, color: "rgba(255,255,255,0.82)", lineHeight: 13 },
          },
        },
        upperLabel: {
          show: true,
          height: 22,
          color: "#ffffff",
          fontSize: 11,
          fontWeight: 700,
        },
        itemStyle: { borderColor: "#ffffff", borderWidth: 1, gapWidth: 2 },
        levels: [
          { itemStyle: { gapWidth: 4, borderWidth: 0 }, upperLabel: { show: true } },
          { itemStyle: { gapWidth: 2, borderWidth: 2, borderColor: "#ffffff" }, upperLabel: { show: true } },
          { itemStyle: { gapWidth: 1, borderWidth: 1, borderColor: "#ffffff" } },
        ],
        data: nodes,
      },
    ],
  };
}
