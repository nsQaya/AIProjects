export type CashFlowRange = "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "10Y";
export type CashFlowGranularity = "day" | "week" | "month" | "year";

export interface CashFlowWindow {
  selection: CashFlowRange;
  from: string;
  to: string;
  granularity: CashFlowGranularity;
}

export function today(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function isoAtLocalNoon(value: string): string {
  return new Date(`${value}T12:00:00`).toISOString();
}

export function isoDay(value: string | null | undefined): string {
  return String(value ?? "").slice(0, 10);
}

function subtractUtcMonths(date: Date, count: number): Date {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - count);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function cashFlowWindow(
  selection: CashFlowRange = "6M",
  now = new Date(),
): CashFlowWindow {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  let start: Date;
  let granularity: CashFlowGranularity = "month";

  switch (selection) {
    case "1M":
      start = subtractUtcMonths(now, 1);
      granularity = "day";
      break;
    case "3M":
      start = subtractUtcMonths(now, 3);
      granularity = "week";
      break;
    case "YTD":
      start = new Date(Date.UTC(year, 0, 1));
      break;
    case "1Y":
      start = new Date(Date.UTC(year, month - 11, 1));
      break;
    case "5Y":
      start = new Date(Date.UTC(year - 4, 0, 1));
      granularity = "year";
      break;
    case "10Y":
      start = new Date(Date.UTC(year - 9, 0, 1));
      granularity = "year";
      break;
    case "6M":
      start = new Date(Date.UTC(year, month - 5, 1));
      break;
  }

  return {
    selection,
    from: start.toISOString(),
    to: now.toISOString(),
    granularity,
  };
}

export function cashFlowLabel(
  periodStart: string | null | undefined,
  period: string | null | undefined,
  granularity: CashFlowGranularity,
): string {
  const date = new Date(periodStart || `${period ?? ""}-01T12:00:00Z`);
  if (granularity === "year") return String(date.getUTCFullYear());

  return new Intl.DateTimeFormat("tr-TR", {
    ...(granularity === "month" ? { month: "short" as const } : { day: "2-digit" as const, month: "short" as const }),
    timeZone: "UTC",
  }).format(date);
}

export function monthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}
