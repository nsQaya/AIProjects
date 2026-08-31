import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { ScheduledTransactionType, UUID } from "@defterx/contracts";

import { Button, InlineFeedback } from "../../components/ui";
import type { AccountView, ScheduledTransactionView } from "../../finance/finance-views";
import { errorMessage } from "../../lib/error-message";
import { dateText, signedMoney } from "../../lib/format";

export type UpcomingFilter = "OPEN" | "COMPLETED" | "ALL";
type KindFilter = "" | ScheduledTransactionType;

interface UpcomingPageProps {
  accounts: readonly AccountView[];
  items: readonly ScheduledTransactionView[];
  onDelete: (item: ScheduledTransactionView) => Promise<void>;
  onEdit: (item: ScheduledTransactionView) => void;
  onNew: () => void;
  onRealize: (item: ScheduledTransactionView) => Promise<void>;
}

const recurrenceLabels = { WEEKLY: "Her hafta", MONTHLY: "Her ay", YEARLY: "Her yıl" } as const;
const kindLabels: Record<ScheduledTransactionType, string> = {
  INCOME: "Gelir",
  EXPENSE: "Gider",
  TRANSFER: "Transfer",
  SALE: "Satış",
  PURCHASE: "Alış",
  COLLECTION: "Tahsilat",
  PAYMENT: "Ödeme",
};
const primaryKinds: readonly ScheduledTransactionType[] = ["INCOME", "EXPENSE", "TRANSFER"];
const isOpen = (item: ScheduledTransactionView) => item.status === "PENDING" || item.status === "OVERDUE";

export function UpcomingPage({ accounts, items, onDelete, onEdit, onNew, onRealize }: UpcomingPageProps) {
  const [filter, setFilter] = useState<UpcomingFilter>("OPEN");
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("");
  const [accountIds, setAccountIds] = useState<readonly UUID[]>(() => accounts.map((account) => account.id));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const knownAccountIdsRef = useRef<readonly UUID[]>(accounts.map((account) => account.id));

  useEffect(() => {
    const nextKnown = accounts.map((account) => account.id);
    const previousKnown = knownAccountIdsRef.current;
    setAccountIds((current) => {
      const allWereSelected = previousKnown.length === 0 || previousKnown.every((id) => current.includes(id));
      return allWereSelected ? nextKnown : current.filter((id) => nextKnown.includes(id));
    });
    knownAccountIdsRef.current = nextKnown;
  }, [accounts]);

  const typeOptions = useMemo(() => {
    const itemKinds = items.map((item) => item.transactionType);
    return [...new Set([...primaryKinds, ...itemKinds, ...(kind ? [kind] : [])])];
  }, [items, kind]);

  const allAccountsSelected = accounts.length > 0 && accounts.every((account) => accountIds.includes(account.id));
  const invalidDateRange = Boolean(from && to && from > to);
  const filteredItems = useMemo(() => {
    if (invalidDateRange) return [];
    const needle = search.toLocaleLowerCase("tr-TR").trim();
    return items.filter((item) => {
      if (kind && item.transactionType !== kind) return false;
      if (
        accounts.length > 0
        && !allAccountsSelected
        && !accountIds.includes(item.accountId)
        && (!item.targetAccountId || !accountIds.includes(item.targetAccountId))
      ) {
        return false;
      }
      if (from && item.ui.date < from) return false;
      if (to && item.ui.date > to) return false;
      return !needle || item.title.toLocaleLowerCase("tr-TR").includes(needle);
    });
  }, [accountIds, accounts.length, allAccountsSelected, from, invalidDateRange, items, kind, search, to]);

  const openCount = filteredItems.filter(isOpen).length;
  const completedCount = filteredItems.filter((item) => item.status === "COMPLETED").length;
  const visibleItems = useMemo(
    () => filteredItems.filter((item) => filter === "ALL" || (filter === "COMPLETED" ? item.status === "COMPLETED" : isOpen(item))),
    [filter, filteredItems],
  );

  const accountLabel = accounts.length === 0
    ? "Hesap yok"
    : allAccountsSelected
      ? "Tüm hesaplar"
      : `${accountIds.length} hesap`;

  const clearFilters = () => {
    setFilter("OPEN");
    setSearch("");
    setKind("");
    setAccountIds(accounts.map((account) => account.id));
    setFrom("");
    setTo("");
  };

  const act = async (item: ScheduledTransactionView, action: () => Promise<void>) => {
    setPendingId(item.id);
    setFeedback("");
    try {
      await action();
    } catch (caught) {
      setFeedback(errorMessage(caught));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="page-section">
      <div className="filter-bar transaction-filters" role="search" aria-label="Yaklaşan işlem filtreleri">
        <div className="search-field">
          ⌕
          <input
            id="upcoming-search"
            type="search"
            aria-label="Açıklamada ara"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Açıklamada ara"
          />
        </div>
        <select
          aria-label="Tür"
          id="upcoming-kind-filter"
          value={kind}
          onChange={(event) => setKind(event.target.value as KindFilter)}
        >
          <option value="">Tüm türler</option>
          {typeOptions.map((type) => <option key={type} value={type}>{kindLabels[type]}</option>)}
        </select>

        <details className="multi-select-filter" id="upcoming-account-filter">
          <summary><small>Hesaplar</small><span>{accountLabel}</span></summary>
          <div className="multi-select-menu">
            <label className="multi-select-all">
              <input
                type="checkbox"
                data-upcoming-account-all
                checked={allAccountsSelected}
                disabled={accounts.length === 0}
                onChange={(event) => setAccountIds(event.target.checked ? accounts.map((account) => account.id) : [])}
              />
              <span>Tüm hesaplar</span>
            </label>
            {accounts.map((account) => (
              <label key={account.id}>
                <input
                  type="checkbox"
                  data-upcoming-account={account.id}
                  checked={accountIds.includes(account.id)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...accountIds, account.id]
                      : accountIds.filter((id) => id !== account.id);
                    setAccountIds([...new Set(next)]);
                  }}
                />
                <span>{account.name}{account.isArchived ? " · Arşivli" : ""}</span>
              </label>
            ))}
          </div>
        </details>

        <label className="date-filter">
          <span>Başlangıç</span>
          <input id="upcoming-from" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="date-filter">
          <span>Bitiş</span>
          <input id="upcoming-to" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <Button className="compact-button" id="clear-upcoming-filters" onClick={clearFilters}>Temizle</Button>
      </div>
      {invalidDateRange ? <InlineFeedback tone="error">Başlangıç tarihi bitiş tarihinden sonra olamaz.</InlineFeedback> : null}
      {feedback ? <InlineFeedback tone="error">{feedback}</InlineFeedback> : null}
      <article className="panel schedule-panel">
        <header className="panel-head">
          <div><h2>Yaklaşan ödeme ve tahsilatlar</h2><p>Tek seferlik ve tekrar eden planlar; “Gerçekleşti” işlem kaydını dolu açar, kaydedince plan da tamamlanır</p></div>
          <Button id="open-scheduled-dialog" onClick={onNew}>+ Planlı işlem</Button>
        </header>
        <div className="status-filter" aria-label="Yaklaşan işlem durumu">
          <button type="button" data-upcoming-filter="OPEN" className={filter === "OPEN" ? "active" : undefined} onClick={() => setFilter("OPEN")}>Gerçekleşmeyenler <b>{openCount}</b></button>
          <button type="button" data-upcoming-filter="COMPLETED" className={filter === "COMPLETED" ? "active" : undefined} onClick={() => setFilter("COMPLETED")}>Gerçekleşenler <b>{completedCount}</b></button>
          <button type="button" data-upcoming-filter="ALL" className={filter === "ALL" ? "active" : undefined} onClick={() => setFilter("ALL")}>Tümü <b>{filteredItems.length}</b></button>
        </div>
        <div className="schedule-list">
          {visibleItems.map((item, index) => {
            const completed = item.status === "COMPLETED";
            const recurrence = item.recurrenceFrequency ? recurrenceLabels[item.recurrenceFrequency] : null;
            const details = [item.ui.costCenterName, item.ui.categoryName, recurrence]
              .filter(Boolean)
              .join(" · ") || "—";
            return (
              <div className={`schedule-row${completed ? " completed" : ""}`} key={item.id}>
                <span className="timeline-dot"><i />{index < visibleItems.length - 1 ? <b /> : null}</span>
                <time>{dateText(item.ui.date)}</time>
                <div><strong>{item.title}</strong><small>{details}</small></div>
                <span className={`status-pill${completed ? " completed-pill" : ""}`}>{completed ? "Gerçekleşti" : item.status === "OVERDUE" ? "Gecikmiş" : "Planlandı"}</span>
                <b className={item.ui.kind}>{signedMoney(item.amount, item.ui.kind)}</b>
                {completed ? (
                  <span className="row-actions schedule-actions"><Link className="success-link" to="/transactions">İşlemi gör</Link></span>
                ) : (
                  <span className="row-actions schedule-actions">
                    <button
                      type="button"
                      className="success-link"
                      data-realize-scheduled={item.id}
                      disabled={pendingId === item.id}
                      onClick={() => void act(item, () => onRealize(item))}
                    >Gerçekleşti</button>
                    <button type="button" data-edit-scheduled={item.id} disabled={pendingId === item.id} onClick={() => onEdit(item)}>Düzenle</button>
                    <button
                      type="button"
                      className="danger-link"
                      data-delete-scheduled={item.id}
                      disabled={pendingId === item.id}
                      onClick={() => {
                        if (globalThis.confirm(`“${item.title}” planı silinsin mi?`)) void act(item, () => onDelete(item));
                      }}
                    >Sil</button>
                  </span>
                )}
              </div>
            );
          })}
          {visibleItems.length === 0 ? <div className="empty-state">Bu filtrelerde kayıt yok.</div> : null}
        </div>
      </article>
    </section>
  );
}
