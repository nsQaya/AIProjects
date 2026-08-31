import {
  BarChart,
  LineChart,
  PieChart,
  TreemapChart,
  type BarSeriesOption,
  type LineSeriesOption,
  type PieSeriesOption,
  type TreemapSeriesOption,
} from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  type AriaComponentOption,
  type GridComponentOption,
  type LegendComponentOption,
  type TitleComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import { use as registerEChartsModules, type ComposeOption, type EChartsType } from "echarts/core";
import { LabelLayout } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";

registerEChartsModules([
  BarChart,
  LineChart,
  PieChart,
  TreemapChart,
  AriaComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  LabelLayout,
  SVGRenderer,
]);

export type ReportChartOption = ComposeOption<
  | AriaComponentOption
  | BarSeriesOption
  | GridComponentOption
  | LegendComponentOption
  | LineSeriesOption
  | PieSeriesOption
  | TitleComponentOption
  | TooltipComponentOption
  | TreemapSeriesOption
>;

export type ReportChartInstance = EChartsType;

export { init } from "echarts/core";
