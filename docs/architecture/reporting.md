# Reporting architecture

DefterX reports use server-authored aggregates and Apache ECharts for visualization. Financial
totals remain decimal strings across the API boundary; chart-only conversion to JavaScript
numbers happens in the web view layer.

## Web layers

- `components/charts/echarts.ts` is the single tree-shakeable ECharts registry. Add a chart or
  component here only when a report needs it.
- `components/charts/ReportChart.tsx` owns SVG initialization, option updates, responsive resize,
  loading state and disposal. Report pages must not initialize ECharts directly.
- Each report module owns pure option builders such as `report-chart-options.ts`. Builders accept
  presentation-ready rows and return typed `ReportChartOption` objects with ARIA enabled.
- `ReportFilters.tsx` is the shared date, multi-account and granularity filter surface. Its value is the
  `ReportRange` contract used by `FinanceService`.
- The report route is lazy-loaded so ECharts does not increase the initial dashboard bundle.

## API filter contract

Filter-capable report endpoints accept `from`, `to` and `accountIds`. Omitted `accountIds` means every account;
`none` means no account; otherwise it is a comma-separated UUID list. The server validates the
selection and performs account scoping before returning aggregates.

All new reports should apply the same scope on the server, keep authorization at book level and
return chart-agnostic DTOs. ECharts option objects must never be sent by the API.

## Implemented report suite

1. Income, expense and net trend: columns plus a net line by day/week/month/year.
2. Account balance history: one line per selected account and an end-balance table.
3. Category and cost-center analysis: category to cost center to source-transaction drill-down.
4. Liquidity forecast: opening ledger balance plus scheduled income, expenses and transfers.
5. Total assets and investment performance: cash, cost basis, as-of-date prices, realized and
   unrealized gains.
6. Holding change comparison: overlaid lines for any mix of brokerage accounts (total holding
   value, book base currency) and individual instruments (unit price, native currency), each
   rebased to 0% at its first known value. The picker is a collapsible tree — accounts on top,
   their instruments nested; an instrument's "home" account is the one that funded most of it.

`GET /reports/analytics` returns these chart-agnostic datasets in one authorized snapshot. This
keeps all tabs on the exact same `from`, `to`, `accountIds` and `granularity` scope and prevents
cross-report timing differences. Investment valuation uses the latest recorded price at or before
the requested end date; when an instrument has no price, totals conservatively carry its cost basis.
`instrumentComparison` reuses that same per-bucket price lookup: `instrumentPoints` are raw unit
prices, `accountPoints` are the summed home-account holding value; percentage rebasing on the
client makes the cross-currency, cross-magnitude lines comparable.

Every report uses the shared date and account selection and must retain an accessible tabular
summary alongside the chart.
