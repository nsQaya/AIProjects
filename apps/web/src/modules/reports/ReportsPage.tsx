import type { CSSProperties } from "react";
import type {
  IncomeExpenseCostCenterItemDTO,
  IncomeExpenseReportItemDTO,
} from "@defterx/contracts";

import { money } from "../../lib/format";

const chartColors = [
  "#287b60",
  "#d6a448",
  "#456fa9",
  "#a95b54",
  "#7b68a6",
  "#6f8d83",
  "#b77c3a",
] as const;

export type ReportCategoryItem = Pick<
  IncomeExpenseReportItemDTO,
  "amount" | "id" | "isActive" | "name" | "type"
>;

export interface ReportsPageProps {
  costCenters: readonly IncomeExpenseCostCenterItemDTO[];
  items: readonly ReportCategoryItem[];
}

interface ExpenseRow {
  amount: number;
  id: string;
  isActive: boolean;
  name: string;
}

function expenseRows(items: readonly ReportCategoryItem[]): ExpenseRow[] {
  return items
    .filter((item) => item.type === "EXPENSE" && Number(item.amount) > 0)
    .map((item) => ({
      amount: Number(item.amount),
      id: item.id,
      isActive: item.isActive,
      name: item.name,
    }))
    .sort((left, right) => right.amount - left.amount);
}

function donutSegments(rows: readonly ExpenseRow[], total: number): string {
  let degree = 0;
  const segments = rows.map((row, index) => {
    const start = degree;
    degree += total > 0 ? (row.amount / total) * 360 : 0;
    return `${chartColors[index % chartColors.length]} ${start}deg ${degree}deg`;
  });

  return segments.join(",") || "#e5e9e6 0deg 360deg";
}

export function ReportsPage({ costCenters, items }: ReportsPageProps) {
  const rows = expenseRows(items);
  const costCenterRows = costCenters
    .filter((item) => Number(item.amount) < 0)
    .map((item) => ({
      amount: -Number(item.amount),
      id: item.id,
      isActive: item.isActive,
      name: item.name,
    }))
    .sort((left, right) => right.amount - left.amount);
  const totalCostCenterExpense = costCenterRows.reduce((sum, item) => sum + item.amount, 0);
  const totalExpense = rows.reduce((sum, item) => sum + item.amount, 0);
  const totalIncome = items
    .filter((item) => item.type === "INCOME")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const savingsRate = totalIncome
    ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100)
    : 0;
  const boundedRate = Math.max(0, Math.min(100, savingsRate));
  const donutStyle = {
    "--segments": donutSegments(rows, totalExpense),
  } as CSSProperties;
  const scoreStyle: CSSProperties = {
    background: `radial-gradient(closest-side,#f5f8f6 78%,transparent 79% 100%),conic-gradient(var(--forest-700) ${boundedRate}%,#dce7e1 0)`,
  };

  return (
    <section className="page-section">
      <div className="report-grid">
        <article className="panel">
          <header className="panel-head">
            <div>
              <h2>Kategori dağılımı</h2>
              <p>Bu ayın canlı gider kayıtları</p>
            </div>
          </header>
          <div className="donut-layout">
            <div className="donut" style={donutStyle}>
              <span>
                <small>Toplam gider</small>
                <strong>{money(totalExpense)}</strong>
              </span>
            </div>
            <div className="report-legend">
              {rows.map((row, index) => (
                <div key={row.id} data-report-category={row.id}>
                  <i
                    aria-hidden="true"
                    style={{ "--dot": chartColors[index % chartColors.length] } as CSSProperties}
                  />
                  <span>
                    {row.name}
                    {row.isActive ? "" : " (pasif)"}
                  </span>
                  <b>
                    %{totalExpense ? Math.round((row.amount / totalExpense) * 100) : 0}
                  </b>
                  <strong>{money(row.amount)}</strong>
                </div>
              ))}
              {rows.length === 0 ? (
                <div className="empty-state">Bu ay gider kaydı yok.</div>
              ) : null}
            </div>
          </div>
        </article>

        <article className="panel savings-card">
          <span>Bu ay net / gelir</span>
          <strong>%{savingsRate}</strong>
          <div className="score-ring" style={scoreStyle}>
            <b>{savingsRate}</b>
            <small>/100</small>
          </div>
          <p>Oran canlı gelir ve gider toplamlarından hesaplanır.</p>
        </article>
      </div>

      <article className="panel cost-center-report">
        <header className="panel-head">
          <div>
            <h2>Masraf merkezi dağılımı</h2>
            <p>Bu ay masraf merkezi atanmış canlı gider kayıtları</p>
          </div>
          <strong>{money(totalCostCenterExpense)}</strong>
        </header>
        <div className="report-legend cost-center-legend">
          {costCenterRows.map((row, index) => (
            <div key={row.id} data-report-cost-center={row.id}>
              <i
                aria-hidden="true"
                style={{ "--dot": chartColors[index % chartColors.length] } as CSSProperties}
              />
              <span>{row.name}{row.isActive ? "" : " (pasif)"}</span>
              <b>
                %{totalCostCenterExpense
                  ? Math.round((row.amount / totalCostCenterExpense) * 100)
                  : 0}
              </b>
              <strong>{money(row.amount)}</strong>
            </div>
          ))}
          {costCenterRows.length === 0 ? (
            <div className="empty-state">Bu ay masraf merkezi atanmış gider yok.</div>
          ) : null}
        </div>
      </article>
    </section>
  );
}
