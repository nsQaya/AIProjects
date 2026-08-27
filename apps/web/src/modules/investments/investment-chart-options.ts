import type { InvestmentValueSeriesItemDTO } from "@defterx/contracts";
import type { ReportChartOption } from "../../components/charts";
import { money, shortMoney } from "../../lib/format";

export function investmentValueHistoryOption(
  items: readonly InvestmentValueSeriesItemDTO[],
): ReportChartOption {
  return {
    animationDuration: 350,
    aria: { enabled: true, decal: { show: true }, description: "Yatırım portföyünün dönem sonu değer gelişimi." },
    color: ["#456fa9"],
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "cross" },
      valueFormatter: (value) => money(Number(value)),
    },
    grid: { left: 18, right: 18, top: 20, bottom: 32, containLabel: true },
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
      {
        name: "Portföy değeri",
        type: "line",
        smooth: true,
        showSymbol: false,
        symbolSize: 6,
        lineStyle: { width: 2 },
        areaStyle: { opacity: 0.12 },
        data: items.map((item) => Number(item.value)),
      },
    ],
  };
}
