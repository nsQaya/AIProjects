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

export function netWorthOption(
  netWorth: ReportAnalyticsResponse["netWorth"],
): ReportChartOption {
  const rows = [
    { name: "Nakit ve hesaplar", value: Number(netWorth.cashBalance) },
    { name: "Yatırımlar", value: Number(netWorth.investmentValue) },
  ].filter((item) => item.value !== 0);
  return {
    animationDuration: 350,
    aria: { enabled: true, decal: { show: true }, description: "Toplam varlığın nakit ve yatırım dağılımı." },
    color: ["#287b60", "#456fa9"],
    title: {
      text: money(Number(netWorth.totalAssets)),
      subtext: "Toplam varlık",
      left: "center",
      top: "40%",
      textStyle: { color: "#1c2924", fontFamily: "Georgia, serif", fontSize: 18 },
      subtextStyle: { color: "#75827c", fontSize: 10 },
    },
    tooltip: { trigger: "item", valueFormatter: (value) => money(Number(value)) },
    legend: { bottom: 0 },
    series: [{
      name: "Varlık",
      type: "pie",
      radius: ["56%", "80%"],
      center: ["50%", "46%"],
      label: { show: false },
      itemStyle: { borderColor: "#fff", borderWidth: 3, borderRadius: 5 },
      data: rows,
    }],
  };
}
