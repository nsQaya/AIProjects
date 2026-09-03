import { useMemo, useState } from "react";
import type { ReportAnalyticsResponse } from "@defterx/contracts";

import { ReportChart } from "../../components/charts";
import { ExportMenu } from "../../components/ui";
import { moneyInCurrency } from "../../lib/format";
import type { ExportTable } from "../../lib/table-export";
import {
  accountValueSeries,
  comparisonChange,
  instrumentComparisonOption,
  instrumentPriceSeries,
  type ComparisonSelection,
} from "./report-chart-options";
import { instrumentComparisonTable } from "./report-export";

type Comparison = ReportAnalyticsResponse["instrumentComparison"];
type Instrument = Comparison["instruments"][number];

export interface InstrumentComparisonPanelProps {
  comparison: Comparison;
  busy?: boolean;
  exportMeta: string[];
  exportActions: (table: ExportTable, filenameBase: string) => { onExcel: () => void; onPdf: () => void };
}

/** Overlaying more than this many lines makes the chart unreadable. */
const MAX_SERIES = 6;
const UNLINKED = "__unlinked__";

type Selection = ComparisonSelection;

interface TreeGroup {
  key: string;
  accountId: string | null;
  name: string;
  instruments: Instrument[];
}

function buildGroups(comparison: Comparison): TreeGroup[] {
  const groups: TreeGroup[] = comparison.accounts.map((account) => ({
    key: account.accountId,
    accountId: account.accountId,
    name: account.name,
    instruments: comparison.instruments.filter((instrument) => instrument.accountId === account.accountId),
  }));
  const unlinked = comparison.instruments.filter((instrument) => instrument.accountId === null);
  if (unlinked.length > 0) {
    groups.push({ key: UNLINKED, accountId: null, name: "Bağlanmamış", instruments: unlinked });
  }
  // An instrument whose home account is out of the report's account filter still
  // appears (its account has no "yekün" line, but the instrument is comparable).
  const grouped = new Set(groups.flatMap((group) => group.instruments.map((instrument) => instrument.instrumentId)));
  const orphans = comparison.instruments.filter((instrument) => !grouped.has(instrument.instrumentId));
  if (orphans.length > 0) {
    const existing = groups.find((group) => group.key === UNLINKED);
    if (existing) existing.instruments.push(...orphans);
    else groups.push({ key: UNLINKED, accountId: null, name: "Diğer", instruments: orphans });
  }
  return groups;
}

function ChangeBadge({ change }: { change: number | null }) {
  if (change === null) return <span className="report-change-badge muted">—</span>;
  const sign = change >= 0 ? "+" : "−";
  const magnitude = Math.abs(change).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <span className={`report-change-badge ${change >= 0 ? "positive" : "negative"}`}>
      {sign}%{magnitude}
    </span>
  );
}

export function InstrumentComparisonPanel({
  comparison,
  busy = false,
  exportMeta,
  exportActions,
}: InstrumentComparisonPanelProps) {
  const [selection, setSelection] = useState<Selection | null>(null);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());

  const accountIds = useMemo(
    () => new Set(comparison.accounts.map((account) => account.accountId)),
    [comparison.accounts],
  );
  const instrumentIds = useMemo(
    () => new Set(comparison.instruments.map((instrument) => instrument.instrumentId)),
    [comparison.instruments],
  );
  const groups = useMemo(() => buildGroups(comparison), [comparison]);

  const defaultSelection = useMemo<Selection>(() => {
    if (comparison.accounts.length >= 2) {
      const ranked = comparison.accounts
        .map((account) => ({
          accountId: account.accountId,
          last: comparisonChange(accountValueSeries(comparison, account.accountId)).last ?? 0,
        }))
        .sort((left, right) => right.last - left.last);
      return { accountIds: ranked.slice(0, 2).map((entry) => entry.accountId), instrumentIds: [] };
    }
    if (comparison.accounts.length === 1) {
      return { accountIds: comparison.accounts.map((account) => account.accountId), instrumentIds: [] };
    }
    return { accountIds: [], instrumentIds: comparison.instruments.slice(0, 3).map((instrument) => instrument.instrumentId) };
  }, [comparison]);

  const active = useMemo<Selection>(() => {
    const base = selection ?? defaultSelection;
    return {
      accountIds: base.accountIds.filter((id) => accountIds.has(id)),
      instrumentIds: base.instrumentIds.filter((id) => instrumentIds.has(id)),
    };
  }, [selection, defaultSelection, accountIds, instrumentIds]);

  const total = active.accountIds.length + active.instrumentIds.length;
  const atLimit = total >= MAX_SERIES;
  const accountSet = new Set(active.accountIds);
  const instrumentSet = new Set(active.instrumentIds);

  const mutate = (kind: "accountIds" | "instrumentIds", id: string) => {
    setSelection((previous) => {
      const base = previous ?? defaultSelection;
      const nextAccounts = new Set(base.accountIds);
      const nextInstruments = new Set(base.instrumentIds);
      const bucket = kind === "accountIds" ? nextAccounts : nextInstruments;
      if (bucket.has(id)) bucket.delete(id);
      else if (nextAccounts.size + nextInstruments.size < MAX_SERIES) bucket.add(id);
      return { accountIds: [...nextAccounts], instrumentIds: [...nextInstruments] };
    });
  };

  const toggleCollapse = (key: string) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (comparison.instruments.length === 0) {
    return (
      <article className="panel">
        <header className="panel-head">
          <div>
            <h2>Varlık Değişim Karşılaştırması</h2>
            <p>Hesapları veya hesapların altındaki araçları seçip performanslarını üst üste kıyaslayın</p>
          </div>
        </header>
        <div className="empty-state">Seçilen kapsamda kıyaslanacak yatırım aracı yok.</div>
      </article>
    );
  }

  const summaryRows = [
    ...active.accountIds
      .map((id) => comparison.accounts.find((account) => account.accountId === id))
      .filter((account): account is Comparison["accounts"][number] => Boolean(account))
      .map((account) => {
        const { first, last, change } = comparisonChange(accountValueSeries(comparison, account.accountId));
        return { key: `a:${account.accountId}`, name: account.name, type: "Hesap yekünü", currency: "TRY", first, last, change };
      }),
    ...active.instrumentIds
      .map((id) => comparison.instruments.find((instrument) => instrument.instrumentId === id))
      .filter((instrument): instrument is Instrument => Boolean(instrument))
      .map((instrument) => {
        const { first, last, change } = comparisonChange(instrumentPriceSeries(comparison, instrument.instrumentId));
        return {
          key: `i:${instrument.instrumentId}`,
          name: instrument.symbol ?? instrument.name,
          type: instrument.assetTypeName,
          currency: instrument.currencyCode,
          first,
          last,
          change,
        };
      }),
  ];

  return (
    <article className="panel report-compare-panel">
      <header className="panel-head">
        <div>
          <h2>Varlık Değişim Karşılaştırması</h2>
          <p>Her seri kendi ilk değerinden %0’a bazlanır; hesap yekünü ile tek tek araçları yan yana kıyaslayın</p>
        </div>
        <div className="report-compare-head-actions">
          <span className="report-compare-count">{total}/{MAX_SERIES}</span>
          {total > 0 ? (
            <ExportMenu
              {...exportActions(
                instrumentComparisonTable(comparison, active, exportMeta),
                "defterx-varlik-karsilastirma",
              )}
            />
          ) : null}
        </div>
      </header>

      {total === 0 ? (
        <div className="empty-state">Kıyaslamak için aşağıdan en az bir hesap veya araç seçin.</div>
      ) : (
        <ReportChart
          busy={busy}
          height={390}
          label="Varlık değişim karşılaştırması"
          option={instrumentComparisonOption(comparison, active)}
        />
      )}

      <div className="report-compare-tree">
        {groups.map((group) => {
          const open = !collapsed.has(group.key);
          const accountChange = group.accountId
            ? comparisonChange(accountValueSeries(comparison, group.accountId)).change
            : null;
          const accountChecked = group.accountId ? accountSet.has(group.accountId) : false;
          return (
            <div key={group.key} className="report-compare-group">
              <div className="report-compare-row report-compare-account">
                <button
                  type="button"
                  className="report-compare-chevron"
                  aria-expanded={open}
                  aria-label={open ? `${group.name} grubunu kapat` : `${group.name} grubunu aç`}
                  onClick={() => toggleCollapse(group.key)}
                >
                  {open ? "▾" : "▸"}
                </button>
                {group.accountId ? (
                  <label className={accountChecked ? "checked" : ""}>
                    <input
                      type="checkbox"
                      checked={accountChecked}
                      disabled={!accountChecked && atLimit}
                      onChange={() => mutate("accountIds", group.accountId!)}
                    />
                    <b>{group.name}</b>
                    <small>hesap yekünü</small>
                  </label>
                ) : (
                  <span className="report-compare-grouplabel">{group.name}</span>
                )}
                <ChangeBadge change={accountChange} />
              </div>
              {open
                ? group.instruments.map((instrument) => {
                    const checked = instrumentSet.has(instrument.instrumentId);
                    const change = comparisonChange(instrumentPriceSeries(comparison, instrument.instrumentId)).change;
                    return (
                      <label
                        key={instrument.instrumentId}
                        className={`report-compare-row report-compare-instrument ${checked ? "checked" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={!checked && atLimit}
                          onChange={() => mutate("instrumentIds", instrument.instrumentId)}
                        />
                        <span>{instrument.symbol ?? instrument.name}</span>
                        <small>{instrument.assetTypeName}</small>
                        <ChangeBadge change={change} />
                      </label>
                    );
                  })
                : null}
            </div>
          );
        })}
      </div>
      {atLimit ? (
        <p className="report-compare-note">En fazla {MAX_SERIES} seri birlikte kıyaslanabilir.</p>
      ) : null}

      {summaryRows.length > 0 ? (
        <div className="report-table-wrap">
          <table className="report-table">
            <thead>
              <tr>
                <th>Seri</th>
                <th>Tür</th>
                <th>Başlangıç</th>
                <th>Son</th>
                <th>Değişim</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => (
                <tr key={row.key}>
                  <td><b>{row.name}</b></td>
                  <td>{row.type}</td>
                  <td>{row.first === null ? "—" : moneyInCurrency(row.first, row.currency)}</td>
                  <td>{row.last === null ? "—" : moneyInCurrency(row.last, row.currency)}</td>
                  <td className={row.change === null ? "" : row.change >= 0 ? "positive" : "negative"}>
                    {row.change === null ? "—" : `%${row.change.toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}
