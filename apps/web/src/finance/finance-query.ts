import type { CashFlowAccountSelection, CashFlowGranularity, UUID } from "@defterx/contracts";

export type CashFlowRange = "1M" | "3M" | "6M" | "YTD" | "1Y" | "5Y" | "10Y";

export interface CashFlowWindow {
  selection: CashFlowRange;
  from: string;
  to: string;
  granularity: CashFlowGranularity;
}

type QueryValue = string | number | boolean | null | undefined;

export function buildQuery(values: Readonly<Record<string, QueryValue>>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    query.set(key, String(value));
  }
  return query.toString();
}

export function isoDay(value: string): string {
  return value.slice(0, 10);
}

export function monthStart(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export function startOfDayBoundary(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
}

export function endOfDayBoundary(value: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T23:59:59.999Z` : value;
}

export function serializeTransactionAccountIds(
  accountIds: readonly UUID[] | undefined,
): string | undefined {
  if (accountIds === undefined) return undefined;
  return accountIds.length > 0 ? accountIds.join(",") : "none";
}

export function serializeCashFlowAccountIds(
  selection: CashFlowAccountSelection | undefined,
): string | undefined {
  if (selection === undefined || selection === "all" || selection === "none") return selection;
  return selection.length > 0 ? selection.join(",") : "none";
}

function subtractUtcMonths(value: Date, count: number): Date {
  const result = new Date(value);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - count);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export function cashFlowWindow(selection: CashFlowRange, now: Date): CashFlowWindow {
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

export function cashFlowLabel(periodStart: string, granularity: CashFlowGranularity): string {
  const date = new Date(periodStart);
  if (granularity === "year") return String(date.getUTCFullYear());
  if (granularity === "day" || granularity === "week") {
    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    }).format(date);
  }
  return new Intl.DateTimeFormat("tr-TR", {
    month: "short",
    timeZone: "UTC",
  }).format(date);
}
