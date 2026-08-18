import { useMemo, useRef, useState, type CSSProperties } from "react";
import type { ClientTransactionType, ScheduledTransactionType } from "@defterx/contracts";

import { InlineFeedback } from "../../components/ui";
import { Icon } from "../../components/ui/Icon";
import type { CashFlowRange } from "../../finance";
import { today } from "../../lib/date";
import { errorMessage } from "../../lib/error-message";
import { dateText, money, signedMoney } from "../../lib/format";
import { CashFlowChart } from "./CashFlowChart";
import { dateIsInWindow, recentDateWindow, upcomingDateWindow } from "./dashboard-range";
import type { DashboardPageProps } from "./dashboard-types";

const RANGE_LABELS: Readonly<Record<CashFlowRange, string>> = {
  "1M": "1 ay",
  "3M": "3 ay",
  "6M": "6 ay",
  YTD: "Yıl başı",
  "1Y": "1 yıl",
  "5Y": "5 yıl",
  "10Y": "10 yıl",
};

const RANGE_ORDER = Object.keys(RANGE_LABELS) as CashFlowRange[];

const monthFormatter = new Intl.DateTimeFormat("tr-TR", { month: "short" });

function scheduledKind(type: ScheduledTransactionType): "income" | "expense" | "transfer" {
  if (["INCOME", "COLLECTION", "SALE"].includes(type)) return "income";
  if (type === "TRANSFER") return "transfer";
  return "expense";
}

function expectedImpact(type: ScheduledTransactionType, amount: number): number {
  const kind = scheduledKind(type);
  if (kind === "income") return amount;
  if (kind === "expense") return -amount;
  return 0;
}

function transactionKind(type: ClientTransactionType): "income" | "expense" | "transfer" {
  if (["INCOME", "COLLECTION", "SALE"].includes(type)) return "income";
  if (["TRANSFER", "OPENING_BALANCE", "ADJUSTMENT"].includes(type)) return "transfer";
  return "expense";
}

function EmptyState({ children }: { children: string }) {
  return <div className="empty-state">{children}</div>;
}

interface ActivityRangeSwitchProps {
  label: string;
  onChange: (range: CashFlowRange) => void;
  range: CashFlowRange;
  section: "upcoming" | "recent";
}

function ActivityRangeSwitch({ label, onChange, range, section }: ActivityRangeSwitchProps) {
  return (
    <div className="range-switch dashboard-card-range" role="group" aria-label={label}>
      {RANGE_ORDER.map((value) => (
        <button
          type="button"
          key={value}
          data-dashboard-range={section}
          data-range-value={value}
          className={range === value ? "active" : undefined}
          aria-pressed={range === value}
          onClick={() => onChange(value)}
        >
          {RANGE_LABELS[value]}
        </button>
      ))}
    </div>
  );
}

export function DashboardPage({
  busy = false,
  snapshot,
  onCashflowAccountsChange,
  onCashflowRangeChange,
  onCashflowVisibilityChange,
}: DashboardPageProps) {
  const [cashflowError, setCashflowError] = useState("");
  const [rangePending, setRangePending] = useState(false);
  const [accountsPending, setAccountsPending] = useState(false);
  const [upcomingRange, setUpcomingRange] = useState<CashFlowRange>("1M");
  const [recentRange, setRecentRange] = useState<CashFlowRange>("1M");
  const [accountIntent, setAccountIntent] = useState<{
    base: readonly string[];
    selected: readonly string[];
  } | null>(null);
  const rangeSequence = useRef(0);
  const accountsSequence = useRef(0);

  const activeAccounts = snapshot.accounts.filter((account) => !account.isArchived);
  const netBalance = activeAccounts.reduce((sum, account) => sum + account.ui.displayBalance, 0);
  const openUpcoming = snapshot.upcoming.filter(
    (item) => item.status === "PENDING" || item.status === "OVERDUE",
  );
  const referenceDay = today();
  const filteredUpcoming = openUpcoming.filter((item) =>
    dateIsInWindow(item.scheduledAt, upcomingDateWindow(upcomingRange, referenceDay)),
  );
  const filteredRecentTransactions = snapshot.dashboard.recentTransactions.filter((item) =>
    dateIsInWindow(item.transactionDate, recentDateWindow(recentRange, referenceDay)),
  );
  const income = snapshot.dashboard.ui.income;
  const expense = snapshot.dashboard.ui.expense;

  const transactionById = useMemo(
    () => new Map(snapshot.transactions.map((transaction) => [transaction.id, transaction])),
    [snapshot.transactions],
  );
  const accountById = useMemo(
    () => new Map(snapshot.accounts.map((account) => [account.id, account])),
    [snapshot.accounts],
  );
  const categoryById = useMemo(
    () => new Map(snapshot.categories.map((category) => [category.id, category])),
    [snapshot.categories],
  );

  const requestedAccountIds =
    accountIntent?.base === snapshot.cashflowAccountIds
      ? accountIntent.selected
      : snapshot.cashflowAccountIds;

  const changeRange = async (range: CashFlowRange) => {
    if (range === snapshot.cashflowRange) return;
    const sequence = ++rangeSequence.current;
    setCashflowError("");
    setRangePending(true);
    try {
      await onCashflowRangeChange(range);
    } catch (caught) {
      if (sequence === rangeSequence.current) setCashflowError(errorMessage(caught));
    } finally {
      if (sequence === rangeSequence.current) setRangePending(false);
    }
  };

  const changeAccounts = async (accountIds: readonly string[]) => {
    const sequence = ++accountsSequence.current;
    setCashflowError("");
    setAccountIntent({ base: snapshot.cashflowAccountIds, selected: accountIds });
    setAccountsPending(true);
    try {
      await onCashflowAccountsChange(accountIds);
    } catch (caught) {
      if (sequence === accountsSequence.current) {
        setAccountIntent(null);
        setCashflowError(errorMessage(caught));
      }
    } finally {
      if (sequence === accountsSequence.current) {
        setAccountIntent(null);
        setAccountsPending(false);
      }
    }
  };

  return (
    <>
      <section className="hero-card">
        <div className="hero-copy">
          <span className="hero-label">Canlı net hesap bakiyesi</span>
          <strong>{money(netBalance)}</strong>
          <span className="positive-chip"><Icon name="sync" /> Neon PostgreSQL verisi</span>
        </div>
        <div className="hero-orbit" aria-hidden="true"><span /><span /><b>₺</b></div>
      </section>

      <section className="metric-grid" aria-label="Aylık özet">
        <article className="metric-card">
          <span className="metric-icon income">↙</span>
          <div><small>Bu ay gelir</small><strong>{money(income)}</strong><em>Kaydedilmiş işlemler</em></div>
        </article>
        <article className="metric-card">
          <span className="metric-icon expense">↗</span>
          <div><small>Bu ay gider</small><strong>{money(expense)}</strong><em>Kaydedilmiş işlemler</em></div>
        </article>
        <article className="metric-card">
          <span className="metric-icon net">◎</span>
          <div><small>Aylık net</small><strong>{money(income - expense)}</strong><em>Gelir eksi gider</em></div>
        </article>
      </section>

      <section className="dashboard-grid">
        <article
          className="panel cashflow-panel"
          aria-busy={busy || rangePending || accountsPending || undefined}
        >
          <header className="panel-head cashflow-head">
            <div>
              <h2>Nakit akışı</h2>
              <p>{RANGE_LABELS[snapshot.cashflowRange]} için gelir, gider ve dönem sonu bakiyesi</p>
            </div>
            <div className="range-switch" role="group" aria-label="Nakit akışı tarih aralığı">
              {RANGE_ORDER.map((range) => (
                <button
                  type="button"
                  key={range}
                  data-cashflow-range={range}
                  className={snapshot.cashflowRange === range ? "active" : undefined}
                  aria-pressed={snapshot.cashflowRange === range}
                  disabled={busy}
                  onClick={() => void changeRange(range)}
                >
                  {RANGE_LABELS[range]}
                </button>
              ))}
            </div>
          </header>

          {cashflowError ? <InlineFeedback tone="error">{cashflowError}</InlineFeedback> : null}

          <CashFlowChart
            accounts={snapshot.accounts}
            accountIds={requestedAccountIds}
            items={snapshot.cashflow}
            visibility={snapshot.cashflowVisible}
            onAccountsChange={(accountIds) => void changeAccounts(accountIds)}
            onVisibilityChange={onCashflowVisibilityChange}
          />
        </article>

        <article className="panel upcoming-card">
          <header className="panel-head">
            <div><h2>Yaklaşan</h2><p>Ödeme ve tahsilatlar</p></div>
            <a href="#/upcoming">Tümünü gör <Icon name="arrow" /></a>
          </header>
          <ActivityRangeSwitch
            label="Yaklaşan tarih aralığı"
            range={upcomingRange}
            section="upcoming"
            onChange={setUpcomingRange}
          />
          <div className="upcoming-list">
            {filteredUpcoming.length > 0 ? filteredUpcoming.slice(0, 5).map((item) => {
              const kind = scheduledKind(item.transactionType);
              return (
                <div className="upcoming-row" key={item.id}>
                  <time dateTime={item.ui.date}>
                    <b>{item.ui.date.slice(8)}</b>
                    <span>{monthFormatter.format(new Date(`${item.ui.date}T12:00:00`))}</span>
                  </time>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.ui.categoryName || "Planlı işlem"}</small>
                  </div>
                  <b className={kind}>{signedMoney(item.ui.amount, kind)}</b>
                </div>
              );
            }) : <EmptyState>Yaklaşan kayıt yok</EmptyState>}
          </div>
          <div className="upcoming-total">
            <span>Beklenen net</span>
            <strong>{money(filteredUpcoming.reduce(
              (sum, item) => sum + expectedImpact(item.transactionType, item.ui.amount),
              0,
            ))}</strong>
          </div>
        </article>
      </section>

      <section className="panel recent-panel">
        <header className="panel-head">
          <div><h2>Son işlemler</h2><p>Canlı defter hareketleri</p></div>
          <a href="#/transactions">Tüm işlemler <Icon name="arrow" /></a>
        </header>
        <ActivityRangeSwitch
          label="Son işlemler tarih aralığı"
          range={recentRange}
          section="recent"
          onChange={setRecentRange}
        />
        <div className="transaction-table">
          <div className="table-head">
            <span>İşlem</span><span>Kategori</span><span>Hesap</span><span>Tarih</span><span>Tutar</span>
          </div>
          {filteredRecentTransactions.length > 0 ? (
            filteredRecentTransactions.slice(0, 5).map((summary) => {
              const detail = transactionById.get(summary.id);
              const rawKind = summary.type.toLowerCase();
              const kind = transactionKind(summary.type);
              const category = detail?.categoryId
                ? categoryById.get(detail.categoryId)?.name ?? detail.categoryName ?? "—"
                : rawKind === "transfer" ? "Transfer" : "—";
              const account = detail?.accountId
                ? accountById.get(detail.accountId)?.name ?? detail.accountName ?? "—"
                : detail?.accountName ?? "—";
              const marker = kind === "income" ? "↙" : kind === "transfer" ? "⇄" : "↗";
              return (
                <div className="table-row" key={summary.id}>
                  <span className="transaction-name">
                    <i style={{ "--dot": "#287b60" } as CSSProperties}>{marker}</i>
                    <b>{detail?.ui.description ?? summary.title}</b>
                  </span>
                  <span>{category}</span>
                  <span>{account}</span>
                  <span>{dateText(summary.transactionDate)}</span>
                  <strong className={kind}>{signedMoney(summary.amount, kind)}</strong>
                </div>
              );
            })
          ) : <EmptyState>Henüz işlem yok</EmptyState>}
        </div>
      </section>
    </>
  );
}
