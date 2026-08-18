import { useState, type FormEvent } from "react";

import { Button, InlineFeedback } from "../../components/ui";
import type { AccountView } from "../../finance";
import type { ReportRange } from "../../finance/finance-state";
import { errorMessage } from "../../lib/error-message";

export interface ReportFiltersProps {
  accounts: readonly AccountView[];
  busy?: boolean;
  onApply: (filter: ReportRange) => Promise<unknown>;
  value: ReportRange;
}

function inputDate(value: string | undefined): string {
  return value?.slice(0, 10) ?? "";
}

export function ReportFilters({ accounts, busy = false, onApply, value }: ReportFiltersProps) {
  const allAccountIds = accounts.map((account) => account.id);
  const [from, setFrom] = useState(() => inputDate(value.from));
  const [to, setTo] = useState(() => inputDate(value.to));
  const [accountIds, setAccountIds] = useState<readonly string[]>(
    () => value.accountIds ?? allAccountIds,
  );
  const [granularity, setGranularity] = useState(value.granularity ?? "month");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const selected = new Set(accountIds);
  const allSelected = accounts.length > 0 && accountIds.length === accounts.length;

  const toggleAccount = (id: string, checked: boolean) => {
    const next = new Set(accountIds);
    if (checked) next.add(id);
    else next.delete(id);
    setAccountIds(allAccountIds.filter((accountId) => next.has(accountId)));
    setFeedback("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (from && to && from > to) {
      setFeedback("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      return;
    }

    setFeedback("");
    setSubmitting(true);
    try {
      await onApply({
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        ...(allSelected ? {} : { accountIds }),
        granularity,
      });
    } catch (caught) {
      setFeedback(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  const accountSummary = allSelected
    ? "Tüm hesaplar"
    : accountIds.length > 0
      ? `${accountIds.length} hesap`
      : "Hesap seçilmedi";

  return (
    <form className="panel report-filter-panel" onSubmit={(event) => void submit(event)}>
      <div className="report-filter-bar">
        <label className="date-filter">
          <span>Başlangıç</span>
          <input
            type="date"
            name="reportFrom"
            value={from}
            disabled={busy || submitting}
            onChange={(event) => { setFrom(event.target.value); setFeedback(""); }}
          />
        </label>
        <label className="date-filter">
          <span>Bitiş</span>
          <input
            type="date"
            name="reportTo"
            value={to}
            disabled={busy || submitting}
            onChange={(event) => { setTo(event.target.value); setFeedback(""); }}
          />
        </label>
        <details className="multi-select-filter report-account-filter">
          <summary>
            <small>Hesaplar</small>
            <span>{accountSummary}</span>
          </summary>
          <div className="multi-select-menu">
            <label className="multi-select-all">
              <input
                type="checkbox"
                data-report-account-all
                checked={allSelected}
                disabled={busy || submitting || accounts.length === 0}
                onChange={(event) => {
                  setAccountIds(event.currentTarget.checked ? allAccountIds : []);
                  setFeedback("");
                }}
              />
              Tüm hesaplar
            </label>
            {accounts.map((account) => (
              <label key={account.id}>
                <input
                  type="checkbox"
                  data-report-account={account.id}
                  checked={selected.has(account.id)}
                  disabled={busy || submitting}
                  onChange={(event) => toggleAccount(account.id, event.currentTarget.checked)}
                />
                <span>{account.name}{account.isArchived ? " · Arşivli" : ""}</span>
              </label>
            ))}
            {accounts.length === 0 ? <span className="muted">Hesap bulunamadı.</span> : null}
          </div>
        </details>
        <label className="date-filter report-granularity-filter">
          <span>Gruplama</span>
          <select
            aria-label="Gruplama"
            value={granularity}
            disabled={busy || submitting}
            onChange={(event) => setGranularity(event.target.value as ReportRange["granularity"] & string)}
          >
            <option value="day">Günlük</option>
            <option value="week">Haftalık</option>
            <option value="month">Aylık</option>
            <option value="year">Yıllık</option>
          </select>
        </label>
        <Button type="submit" variant="primary" loading={submitting} disabled={busy}>
          Raporu uygula
        </Button>
      </div>
      {feedback ? <InlineFeedback tone="error">{feedback}</InlineFeedback> : null}
    </form>
  );
}
