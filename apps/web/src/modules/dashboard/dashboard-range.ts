import { cashFlowWindow, type CashFlowRange } from "../../finance/finance-query";

export interface DashboardDateWindow {
  from: string;
  to: string;
}

function referenceDate(referenceDay: string): Date {
  return new Date(`${referenceDay}T12:00:00.000Z`);
}

function addUtcMonths(value: Date, count: number): Date {
  const result = new Date(value);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + count);
  const lastDay = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function endOfUtcMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999));
}

function endOfUtcYear(year: number): Date {
  return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
}

export function recentDateWindow(
  selection: CashFlowRange,
  referenceDay: string,
): DashboardDateWindow {
  const window = cashFlowWindow(selection, referenceDate(referenceDay));
  return { from: window.from.slice(0, 10), to: referenceDay };
}

export function upcomingDateWindow(
  selection: CashFlowRange,
  referenceDay: string,
): DashboardDateWindow {
  const now = referenceDate(referenceDay);
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  let end: Date;

  switch (selection) {
    case "1M":
      end = addUtcMonths(now, 1);
      break;
    case "3M":
      end = addUtcMonths(now, 3);
      break;
    case "YTD":
      end = endOfUtcYear(year);
      break;
    case "1Y":
      end = endOfUtcMonth(year, month + 11);
      break;
    case "5Y":
      end = endOfUtcYear(year + 4);
      break;
    case "10Y":
      end = endOfUtcYear(year + 9);
      break;
    case "6M":
      end = endOfUtcMonth(year, month + 5);
      break;
  }

  return { from: referenceDay, to: end.toISOString().slice(0, 10) };
}

export function dateIsInWindow(value: string, window: DashboardDateWindow): boolean {
  const day = value.slice(0, 10);
  return day >= window.from && day <= window.to;
}
