import { useState, type CSSProperties } from "react";
import type { UUID } from "@defterx/contracts";

import type { AccountView, CashFlowView } from "../../finance/finance-views";
import type { CashFlowVisibility } from "../../finance/finance-state";
import { money, shortMoney } from "../../lib/format";

const CHART = {
  width: 920,
  height: 286,
  left: 64,
  right: 72,
  top: 18,
  bottom: 42,
} as const;

export interface CashFlowChartProps {
  accounts: readonly AccountView[];
  accountIds: readonly UUID[];
  items: readonly CashFlowView[];
  visibility: CashFlowVisibility;
  onAccountsChange: (accountIds: readonly UUID[]) => void;
  onVisibilityChange: (patch: Partial<CashFlowVisibility>) => void;
}

function finite(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

function tooltipLeft(index: number, count: number): CSSProperties["left"] {
  const percentage = count > 0 ? ((index + 0.5) / count) * 100 : 50;
  return `clamp(83px, ${percentage}%, calc(100% - 83px))`;
}

export function CashFlowChart({
  accounts,
  accountIds,
  items,
  visibility,
  onAccountsChange,
  onVisibilityChange,
}: CashFlowChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const activeAccounts = accounts.filter((account) => !account.isArchived);
  const selected = new Set(accountIds);
  const allSelected =
    activeAccounts.length > 0 && activeAccounts.every((account) => selected.has(account.id));

  const plotWidth = CHART.width - CHART.left - CHART.right;
  const plotHeight = CHART.height - CHART.top - CHART.bottom;
  const step = items.length > 0 ? plotWidth / items.length : plotWidth;
  const barWidth = Math.max(3, Math.min(16, step * 0.27));
  const barSeriesCount = Number(visibility.income) + Number(visibility.expense);
  const barValues = items.flatMap((item) => [
    visibility.income ? finite(item.ui.income) : 0,
    visibility.expense ? finite(item.ui.expense) : 0,
  ]);
  const balanceValues = items.map((item) => finite(item.ui.balance));
  // Income/expense bars never go negative, but the balance line can. Rather than
  // scaling the two series on fully independent axes (which puts "0" at a
  // different height for each - the bars' baseline at the bottom, the balance
  // line's zero wherever its own min/max happens to fall), both series share one
  // zero baseline (zeroY) here: a "positive zone" above it sized by whichever
  // series reaches higher, and a "negative zone" below it sized by how negative
  // the balance gets. A value of 0 in either series always lands on zeroY.
  const balancePositiveExtent = visibility.balance ? Math.max(0, ...balanceValues) : 0;
  const balanceNegativeExtent = visibility.balance ? Math.max(0, ...balanceValues.map((value) => -value)) : 0;
  const positiveExtent = Math.max(1, ...barValues, balancePositiveExtent);
  const hasNegativeZone = balanceNegativeExtent > 0;
  const positiveRatio = hasNegativeZone
    ? Math.min(0.82, Math.max(0.18, positiveExtent / (positiveExtent + balanceNegativeExtent)))
    : 1;
  const zeroY = CHART.top + plotHeight * positiveRatio;
  const positiveZoneHeight = zeroY - CHART.top;
  const negativeZoneHeight = CHART.top + plotHeight - zeroY;
  const barY = (value: number) => {
    const magnitude = Math.max(0, finite(value));
    return positiveZoneHeight > 0 ? zeroY - (magnitude / positiveExtent) * positiveZoneHeight : zeroY;
  };
  const balanceY = (value: number) => {
    const amount = finite(value);
    if (amount >= 0) {
      return positiveZoneHeight > 0 ? zeroY - (amount / positiveExtent) * positiveZoneHeight : zeroY;
    }
    return negativeZoneHeight > 0 ? zeroY + (-amount / balanceNegativeExtent) * negativeZoneHeight : zeroY;
  };
  const valueAtY = (y: number, extentAbove: number, extentBelow: number) => {
    const raw =
      y <= zeroY
        ? positiveZoneHeight > 0
          ? (extentAbove * (zeroY - y)) / positiveZoneHeight
          : 0
        : negativeZoneHeight > 0
          ? (-extentBelow * (y - zeroY)) / negativeZoneHeight
          : 0;
    // extentBelow is 0 for the bar axis (bars never go negative), so the negative
    // branch above computes -0 * something = -0 there. Intl.NumberFormat renders
    // that as the text "-0", which is exactly the left/right mismatch reported -
    // normalize it back to a plain zero.
    return raw || 0;
  };
  const labelEvery = Math.max(1, Math.ceil(items.length / 10));
  const activeItem = activeIndex === null ? null : (items[activeIndex] ?? null);

  const changeAccount = (id: UUID, checked: boolean) => {
    const next = new Set(accountIds);
    if (checked) next.add(id);
    else next.delete(id);
    onAccountsChange([...next]);
  };

  return (
    <>
      <div className="cashflow-visual" onMouseLeave={() => setActiveIndex(null)}>
        <svg
          className="cashflow-svg"
          viewBox={`0 0 ${CHART.width} ${CHART.height}`}
          role="img"
          aria-label="Gelir ve gider sütunları ile dönem sonu bakiye çizgisi"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = CHART.top + plotHeight * (1 - ratio);
            // Bars and the balance line share one geometric scale (see zeroY/
            // positiveExtent/negativeExtent above), so a given row means the same
            // amount for both - the left and right labels now always agree, mirrored
            // purely for readability on a wide chart, not because they're different
            // scales. (Bars themselves still never draw below zeroY: income/expense
            // can't be negative. The axis simply reports what that row means.)
            const axisValue = valueAtY(y, positiveExtent, balanceNegativeExtent);
            return (
              <g key={ratio}>
                <line
                  className="chart-grid-line"
                  x1={CHART.left}
                  y1={y}
                  x2={CHART.width - CHART.right}
                  y2={y}
                />
                <text
                  className="chart-axis-label"
                  x={CHART.left - 10}
                  y={y + 3}
                  textAnchor="end"
                >
                  {shortMoney(axisValue)}
                </text>
                {visibility.balance ? (
                  <text
                    className="chart-axis-label balance-axis-label"
                    x={CHART.width - CHART.right + 10}
                    y={y + 3}
                    textAnchor="start"
                  >
                    {shortMoney(axisValue)}
                  </text>
                ) : null}
              </g>
            );
          })}

          {hasNegativeZone ? (
            <g>
              <line
                className="chart-grid-line chart-zero-line"
                data-cashflow-zero-line
                x1={CHART.left}
                y1={zeroY}
                x2={CHART.width - CHART.right}
                y2={zeroY}
              />
              <text className="chart-axis-label chart-zero-label" x={CHART.left - 10} y={zeroY + 3} textAnchor="end">
                {shortMoney(0)}
              </text>
              {visibility.balance ? (
                <text
                  className="chart-axis-label balance-axis-label chart-zero-label"
                  x={CHART.width - CHART.right + 10}
                  y={zeroY + 3}
                  textAnchor="start"
                >
                  {shortMoney(0)}
                </text>
              ) : null}
            </g>
          ) : null}

          {items.map((item, index) => {
            const center = CHART.left + step * (index + 0.5);
            const income = finite(item.ui.income);
            const expense = finite(item.ui.expense);
            const incomeHeight = Math.max(income > 0 ? 2 : 0, zeroY - barY(income));
            const expenseHeight = Math.max(expense > 0 ? 2 : 0, zeroY - barY(expense));
            return (
              <g key={`${item.periodStart}-${index}`}>
                {visibility.income && income > 0 ? (
                  <rect
                    className="cashflow-bar income-bar"
                    data-cashflow-bar="income"
                    data-cashflow-bar-index={index}
                    x={center - (barSeriesCount === 2 ? barWidth + 2 : barWidth / 2)}
                    y={zeroY - incomeHeight}
                    width={barWidth}
                    height={incomeHeight}
                    rx="3"
                  />
                ) : null}
                {visibility.expense && expense > 0 ? (
                  <rect
                    className="cashflow-bar expense-bar"
                    data-cashflow-bar="expense"
                    data-cashflow-bar-index={index}
                    x={center + (barSeriesCount === 2 ? 2 : -barWidth / 2)}
                    y={zeroY - expenseHeight}
                    width={barWidth}
                    height={expenseHeight}
                    rx="3"
                  />
                ) : null}
              </g>
            );
          })}

          {visibility.balance && items.length > 0 ? (
            <>
              <polyline
                className="balance-line"
                points={items
                  .map(
                    (item, index) =>
                      `${CHART.left + step * (index + 0.5)},${balanceY(item.ui.balance)}`,
                  )
                  .join(" ")}
              />
              {items.map((item, index) => (
                <circle
                  className="balance-point"
                  key={`${item.periodStart}-balance-${index}`}
                  cx={CHART.left + step * (index + 0.5)}
                  cy={balanceY(item.ui.balance)}
                  r="3"
                />
              ))}
            </>
          ) : null}

          {items.map((item, index) =>
            index % labelEvery === 0 || index === items.length - 1 ? (
              <text
                className="chart-period-label"
                key={`${item.periodStart}-label-${index}`}
                x={CHART.left + step * (index + 0.5)}
                y={CHART.height - 14}
                textAnchor="middle"
              >
                {item.ui.label}
              </text>
            ) : null,
          )}

          {items.map((item, index) => (
            <rect
              className="chart-hit"
              data-cashflow-index={index}
              key={`${item.periodStart}-hit-${index}`}
              tabIndex={0}
              role="img"
              aria-label={`${item.ui.label}: gelir ${money(item.ui.income)}, gider ${money(item.ui.expense)}, bakiye ${money(item.ui.balance)}`}
              x={CHART.left + step * index}
              y={CHART.top}
              width={step}
              height={plotHeight}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              onMouseEnter={() => setActiveIndex(index)}
            />
          ))}
        </svg>

        <div
          className="cashflow-tooltip"
          id="cashflow-tooltip"
          data-active-index={activeIndex ?? undefined}
          hidden={activeItem === null}
          style={{ left: activeIndex === null ? "50%" : tooltipLeft(activeIndex, items.length) }}
        >
          <strong data-tooltip-label>{activeItem?.ui.label}</strong>
          <span data-tooltip-row="income" hidden={!visibility.income}>
            Gelir <b className="income" data-tooltip-income>{money(activeItem?.ui.income ?? 0)}</b>
          </span>
          <span data-tooltip-row="expense" hidden={!visibility.expense}>
            Gider <b className="expense" data-tooltip-expense>{money(activeItem?.ui.expense ?? 0)}</b>
          </span>
          <span data-tooltip-row="balance" hidden={!visibility.balance}>
            Bakiye <b className="balance" data-tooltip-balance>{money(activeItem?.ui.balance ?? 0)}</b>
          </span>
        </div>
      </div>

      <div className="cashflow-series-controls" aria-label="Grafikte gösterilecek değerler">
        <label>
          <input
            type="checkbox"
            data-cashflow-series="income"
            checked={visibility.income}
            onChange={(event) => onVisibilityChange({ income: event.currentTarget.checked })}
          />
          <i className="legend-income" />Gelir
        </label>
        <label>
          <input
            type="checkbox"
            data-cashflow-series="expense"
            checked={visibility.expense}
            onChange={(event) => onVisibilityChange({ expense: event.currentTarget.checked })}
          />
          <i className="legend-expense" />Gider
        </label>
        <label>
          <input
            type="checkbox"
            data-cashflow-series="balance"
            checked={visibility.balance}
            onChange={(event) => onVisibilityChange({ balance: event.currentTarget.checked })}
          />
          <i className="legend-balance" />Bakiye
        </label>
      </div>

      {visibility.balance ? (
        <div className="cashflow-account-selector">
          <div className="cashflow-account-head">
            <div>
              <strong>Bakiyeye dahil hesaplar</strong>
              <small>{selected.size} / {activeAccounts.length} hesap seçili</small>
            </div>
            <label>
              <input
                type="checkbox"
                data-cashflow-account-all
                checked={allSelected}
                onChange={(event) =>
                  onAccountsChange(
                    event.currentTarget.checked
                      ? activeAccounts.map((account) => account.id)
                      : [],
                  )
                }
              />
              Tüm hesaplar
            </label>
          </div>
          <div className="cashflow-account-list">
            {activeAccounts.length > 0 ? (
              activeAccounts.map((account) => (
                <label key={account.id}>
                  <input
                    type="checkbox"
                    data-cashflow-account={account.id}
                    checked={selected.has(account.id)}
                    onChange={(event) => changeAccount(account.id, event.currentTarget.checked)}
                  />
                  <span>{account.name}</span>
                </label>
              ))
            ) : (
              <span className="muted">Seçilebilecek aktif hesap yok.</span>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
