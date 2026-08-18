import { useEffect, useRef } from "react";

import { init, type ReportChartInstance, type ReportChartOption } from "./echarts";

export interface ReportChartProps {
  busy?: boolean;
  className?: string;
  height?: number;
  label: string;
  option: ReportChartOption;
}

export function ReportChart({
  busy = false,
  className = "",
  height = 300,
  label,
  option,
}: ReportChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReportChartInstance | null>(null);
  const initialHeightRef = useRef(height);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = init(container, undefined, {
      renderer: "svg",
      width: container.clientWidth || 640,
      height: initialHeightRef.current,
    });
    chartRef.current = chart;
    const resize = () => chart.resize();
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(resize);

    if (observer) observer.observe(container);
    else window.addEventListener("resize", resize);

    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", resize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    if (busy) chart.showLoading("default", { text: "Rapor yükleniyor" });
    else chart.hideLoading();
  }, [busy]);

  return (
    <div
      ref={containerRef}
      className={`report-chart ${className}`.trim()}
      data-report-chart
      role="img"
      aria-label={label}
      style={{ height }}
    />
  );
}
