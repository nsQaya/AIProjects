import { useEffect, useRef, useState } from "react";
import type { ReportAnalyticsResponse } from "@defterx/contracts";

import { monthStart } from "../../lib/date";
import type { ReportRange } from "../../finance/finance-state";

export type ReportKey = "trend" | "balances" | "categories" | "liquidity" | "netWorth";

export const REPORT_KEYS: readonly ReportKey[] = ["trend", "balances", "categories", "liquidity", "netWorth"];

export interface ReportSectionState {
  analytics: ReportAnalyticsResponse | null;
  range: ReportRange;
  busy: boolean;
  failed: boolean;
}

const dayMs = 24 * 60 * 60 * 1000;

// Four of the five reports look backward at what already happened, so they
// default to the same month-to-date window. The liquidity forecast looks
// forward instead - its default spans from this month's start out to roughly
// two months ahead, so both recent activity and the near-term projection are
// visible without the user having to set a range first.
function defaultRange(key: ReportKey, now: Date): ReportRange {
  if (key === "liquidity") {
    return { from: monthStart(now), to: new Date(now.getTime() + 60 * dayMs).toISOString(), granularity: "day" };
  }
  return { from: monthStart(now), to: now.toISOString(), granularity: "month" };
}

/**
 * Owns one independent {range, analytics} slice per report tab, so applying a
 * filter on one report (e.g. extending "Likidite tahmini" into next quarter)
 * never touches another report's (e.g. "Gelir · Gider · Net") own range.
 */
export function useReportSections(
  fetch: (range: ReportRange) => Promise<ReportAnalyticsResponse>,
): {
  sections: Record<ReportKey, ReportSectionState>;
  apply: (key: ReportKey, range: ReportRange) => Promise<void>;
} {
  const [sections, setSections] = useState<Record<ReportKey, ReportSectionState>>(() => {
    const now = new Date();
    const initial = {} as Record<ReportKey, ReportSectionState>;
    for (const key of REPORT_KEYS) {
      initial[key] = { analytics: null, range: defaultRange(key, now), busy: false, failed: false };
    }
    return initial;
  });
  const sequence = useRef<Record<ReportKey, number>>(
    Object.fromEntries(REPORT_KEYS.map((key) => [key, 0])) as Record<ReportKey, number>,
  );

  const apply = async (key: ReportKey, range: ReportRange) => {
    const mine = ++sequence.current[key];
    setSections((state) => ({ ...state, [key]: { ...state[key], range, busy: true } }));
    try {
      const analytics = await fetch(range);
      if (mine !== sequence.current[key]) return;
      setSections((state) => ({ ...state, [key]: { analytics, range, busy: false, failed: false } }));
    } catch (error) {
      if (mine === sequence.current[key]) {
        setSections((state) => ({ ...state, [key]: { ...state[key], busy: false, failed: true } }));
      }
      throw error;
    }
  };

  // Warm every tab once on mount with its own default range, so switching
  // tabs never shows an empty panel while a first fetch is still pending.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- genuine fetch-on-mount, not derived state
    for (const key of REPORT_KEYS) void apply(key, sections[key].range).catch(() => {});
    // Intentionally runs once - later applies are driven by each tab's own filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { sections, apply };
}
