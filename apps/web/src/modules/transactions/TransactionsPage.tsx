import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { CategoryDTO, CostCenterDTO, UUID } from "@defterx/contracts";

import { Button, ConfirmDialog, InlineFeedback } from "../../components/ui";
import type { AccountView, TransactionView } from "../../finance/finance-views";
import { downloadCsv, type CsvValue } from "../../lib/csv";
import { dateText, money } from "../../lib/format";
import { today } from "../../lib/date";
import { errorMessage } from "../../lib/error-message";
import type { TransactionLedgerFilter } from "./transaction-types";

type KindFilter = "" | "income" | "expense" | "transfer";

interface TransactionsPageProps {
  accounts: readonly AccountView[];
  categories: readonly CategoryDTO[];
  costCenters: readonly CostCenterDTO[];
  loading?: boolean;
  onDelete: (transaction: TransactionView) => Promise<void>;
  onEdit: (transaction: TransactionView) => void;
  onLedgerFilterChange: (filter: TransactionLedgerFilter) => Promise<void>;
  onNotify: (message: string) => void;
  openingBalance: string;
  transactions: readonly TransactionView[];
}

const kindLabels: Record<string, string> = {
  income: "Gelir",
  expense: "Gider",
  transfer: "Transfer",
  opening_balance: "Açılış bakiyesi",
  adjustment: "Düzeltme",
  sale: "Satış",
  purchase: "Alış",
};

function transactionSearchText(
  transaction: TransactionView,
  accountName: string,
  targetName: string,
  categoryName: string,
  costCenterName: string,
): string {
  return `${transaction.ui.description} ${accountName} ${targetName} ${categoryName} ${costCenterName} ${kindLabels[transaction.ui.kind] ?? ""}`
    .toLocaleLowerCase("tr-TR");
}

function impactMoney(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value))}`;
}

export function TransactionsPage({
  accounts,
  categories,
  costCenters,
  loading = false,
  onDelete,
  onEdit,
  onLedgerFilterChange,
  onNotify,
  openingBalance,
  transactions,
}: TransactionsPageProps) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<KindFilter>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [accountIds, setAccountIds] = useState<readonly UUID[]>([]);
  const [feedback, setFeedback] = useState("");
  const [transactionToDelete, setTransactionToDelete] = useState<TransactionView | null>(null);
  const knownIdsRef = useRef<readonly UUID[]>([]);

  useEffect(() => {
    const nextKnown = accounts.map((account) => account.id);
    const previousKnown = knownIdsRef.current;
    setAccountIds((current) => {
      const allWereSelected = previousKnown.length === 0 || previousKnown.every((id) => current.includes(id));
      return allWereSelected ? nextKnown : current.filter((id) => nextKnown.includes(id));
    });
    knownIdsRef.current = nextKnown;
  }, [accounts]);

  const accountById = useMemo(() => new Map(accounts.map((account) => [account.id, account])), [accounts]);
  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const costCenterById = useMemo(() => new Map(costCenters.map((item) => [item.id, item])), [costCenters]);

  const rows = useMemo(() => {
    const needle = search.toLocaleLowerCase("tr-TR").trim();
    const filtered = transactions.filter((transaction) => {
      if (kind && transaction.ui.kind !== kind) return false;
      if (costCenterId && transaction.costCenterId !== costCenterId) return false;
      const source = transaction.accountId ? accountById.get(transaction.accountId)?.name ?? transaction.accountName ?? "" : "";
      const target = transaction.targetAccountId ? accountById.get(transaction.targetAccountId)?.name ?? transaction.targetAccountName ?? "" : "";
      const category = transaction.categoryId ? categoryById.get(transaction.categoryId)?.name ?? transaction.categoryName ?? "" : "";
      const costCenter = transaction.costCenterId ? costCenterById.get(transaction.costCenterId)?.name ?? transaction.costCenterName ?? "" : "";
      return !needle || transactionSearchText(transaction, source, target, category, costCenter).includes(needle);
    });
    return from
      ? [...filtered].sort((left, right) => left.ui.date.localeCompare(right.ui.date) || Number(left.transactionNo) - Number(right.transactionNo))
      : filtered;
  }, [accountById, categoryById, costCenterById, costCenterId, from, kind, search, transactions]);

  const load = async (next: TransactionLedgerFilter) => {
    if (next.from && next.to && next.from > next.to) {
      setFeedback("Başlangıç tarihi bitiş tarihinden sonra olamaz.");
      return;
    }
    setFeedback("");
    try {
      await onLedgerFilterChange(next);
    } catch (caught) {
      setFeedback(errorMessage(caught));
    }
  };

  const changeAccounts = (nextIds: readonly UUID[]) => {
    setAccountIds(nextIds);
    void load({ accountIds: nextIds, costCenterId: costCenterId || undefined, from, to });
  };

  const changeFrom = (nextFrom: string) => {
    setFrom(nextFrom);
    void load({ accountIds, costCenterId: costCenterId || undefined, from: nextFrom, to });
  };

  const changeTo = (nextTo: string) => {
    setTo(nextTo);
    void load({ accountIds, costCenterId: costCenterId || undefined, from, to: nextTo });
  };

  const changeCostCenter = (nextCostCenterId: string) => {
    setCostCenterId(nextCostCenterId);
    void load({
      accountIds,
      costCenterId: nextCostCenterId || undefined,
      from,
      to,
    });
  };

  const clearFilters = () => {
    const allIds = accounts.map((account) => account.id);
    setSearch("");
    setKind("");
    setFrom("");
    setTo("");
    setCostCenterId("");
    setAccountIds(allIds);
    void load({ accountIds: allIds, from: "", to: "" });
  };

  const exportRows = () => {
    if (rows.length === 0) {
      onNotify("Dışa aktarılacak kayıt yok.");
      return;
    }

    const values: CsvValue[][] = [
      ["Tarih", "Tür", "Açıklama", "Kaynak hesap", "Hedef hesap", "Masraf merkezi", "Kategori", "Tutar", "Yürüyen bakiye"],
    ];
    if (from) values.push([from, "devir", "Başlangıç öncesi devir", "", "", "", "", 0, openingBalance]);
    for (const transaction of rows) {
      values.push([
        transaction.ui.date,
        transaction.ui.kind,
        transaction.ui.description,
        transaction.accountId ? accountById.get(transaction.accountId)?.name ?? transaction.accountName ?? "" : "",
        transaction.targetAccountId ? accountById.get(transaction.targetAccountId)?.name ?? transaction.targetAccountName ?? "" : "",
        transaction.costCenterId ? costCenterById.get(transaction.costCenterId)?.name ?? transaction.costCenterName ?? "" : "",
        transaction.categoryId ? categoryById.get(transaction.categoryId)?.name ?? transaction.categoryName ?? "" : "",
        transaction.balanceDelta,
        transaction.runningBalance,
      ]);
    }
    downloadCsv(`defterx-islemler-${today()}.csv`, values);
    onNotify(`${rows.length} işlem dışa aktarıldı.`);
  };

  const allSelected = accounts.length > 0 && accounts.every((account) => accountIds.includes(account.id));
  const accountLabel = allSelected ? "Tüm hesaplar" : `${accountIds.length} hesap`;

  return (
    <section className="page-section">
      <div className="filter-bar transaction-filters">
        <div className="search-field">⌕ <input id="transaction-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="İşlemlerde ara" /></div>
        <select aria-label="Tür" id="transaction-kind-filter" value={kind} onChange={(event) => setKind(event.target.value as KindFilter)}>
          <option value="">Tüm türler</option>
          <option value="income">Gelir</option>
          <option value="expense">Gider</option>
          <option value="transfer">Transfer</option>
        </select>
        <select
          aria-label="Masraf merkezi"
          id="transaction-cost-center-filter"
          value={costCenterId}
          onChange={(event) => changeCostCenter(event.target.value)}
        >
          <option value="">Tüm masraf merkezleri</option>
          {costCenters.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}{item.isActive ? "" : " · Pasif"}
            </option>
          ))}
        </select>

        <details className="multi-select-filter" id="transaction-account-filter">
          <summary><small>Hesaplar</small><span>{accountLabel}</span></summary>
          <div className="multi-select-menu">
            <label className="multi-select-all">
              <input
                type="checkbox"
                data-transaction-account-all
                checked={allSelected}
                onChange={(event) => changeAccounts(event.target.checked ? accounts.map((account) => account.id) : [])}
              />
              <span>Tüm hesaplar</span>
            </label>
            {accounts.map((account) => (
              <label key={account.id}>
                <input
                  type="checkbox"
                  data-transaction-account={account.id}
                  checked={accountIds.includes(account.id)}
                  onChange={(event) => {
                    const next = event.target.checked
                      ? [...accountIds, account.id]
                      : accountIds.filter((id) => id !== account.id);
                    changeAccounts([...new Set(next)]);
                  }}
                />
                <span>{account.name}{account.isArchived ? " · Arşivli" : ""}</span>
              </label>
            ))}
          </div>
        </details>

        <label className="date-filter"><span>Başlangıç</span><input id="transaction-from" type="date" value={from} onChange={(event) => changeFrom(event.target.value)} /></label>
        <label className="date-filter"><span>Bitiş</span><input id="transaction-to" type="date" value={to} onChange={(event) => changeTo(event.target.value)} /></label>
        <Button className="compact-button" id="clear-transaction-filters" onClick={clearFilters}>Temizle</Button>
      </div>

      {feedback ? <InlineFeedback tone="error">{feedback}</InlineFeedback> : null}

      <article className="panel transaction-panel" aria-busy={loading || undefined}>
        <header className="panel-head">
          <div><h2>İşlem defteri</h2><p id="transaction-result-count">{rows.length} kayıt bulundu</p></div>
          <Button id="export-transactions" onClick={exportRows}>Dışa aktar (.csv)</Button>
        </header>
        <div className="transaction-table expanded transaction-ledger" id="all-transactions">
          <div className="table-head"><span>İşlem</span><span>Masraf merkezi</span><span>Kategori</span><span>Hesap</span><span>Tarih</span><span>Tutar</span><span>Yürüyen bakiye</span><span>İşlemler</span></div>
          {from ? (
            <div className="table-row carry-row" data-carry-row>
              <span className="transaction-name"><i style={{ "--dot": "#66829f" } as CSSProperties}>↪</i><b>Devir</b></span>
              <span>—</span><span>Başlangıç öncesi</span><span>Seçili hesaplar</span><span>{dateText(from)}</span><strong>—</strong><strong>{money(openingBalance)}</strong><span><small>Devir bakiyesi</small></span>
            </div>
          ) : null}
          {rows.map((transaction) => {
            const source = transaction.accountId ? accountById.get(transaction.accountId)?.name ?? transaction.accountName ?? "Hesap" : "—";
            const target = transaction.targetAccountId ? accountById.get(transaction.targetAccountId)?.name ?? transaction.targetAccountName ?? "Hedef" : "";
            const category = transaction.ui.kind === "transfer"
              ? "Hesaplar arası"
              : transaction.categoryId
                ? categoryById.get(transaction.categoryId)?.name ?? transaction.categoryName ?? "—"
                : transaction.ui.kind === "opening_balance"
                  ? "Açılış bakiyesi"
                  : transaction.ui.kind === "adjustment"
                    ? "Sistem düzeltmesi"
                    : "—";
            const account = transaction.ui.kind === "transfer" ? `${source} → ${target}` : source;
            const costCenter = transaction.costCenterId
              ? costCenterById.get(transaction.costCenterId)?.name ?? transaction.costCenterName ?? "—"
              : "—";
            const editable = ["income", "expense", "transfer"].includes(transaction.ui.kind);
            return (
              <div
                className="table-row"
                key={transaction.id}
                data-transaction-id={transaction.id}
                data-kind={transaction.ui.kind}
                data-date={transaction.ui.date}
                data-search={transactionSearchText(transaction, source, target, category, costCenter)}
              >
                <span className="transaction-name"><i style={{ "--dot": "#287b60" } as CSSProperties}>{transaction.ui.kind === "income" ? "↙" : transaction.ui.kind === "transfer" ? "⇄" : transaction.ui.kind === "opening_balance" ? "↪" : "↗"}</i><b>{transaction.ui.description}</b></span>
                <span>{costCenter}</span><span>{category}</span><span>{account}</span><span>{dateText(transaction.ui.date)}</span>
                <strong className={transaction.ui.balanceDelta < 0 ? "expense" : transaction.ui.balanceDelta > 0 ? "income" : "transfer"}>{impactMoney(transaction.ui.balanceDelta)}</strong>
                <strong className="running-balance">{money(transaction.runningBalance)}</strong>
                <span className="row-actions">
                  {editable ? (
                    <>
                      <button type="button" data-edit-transaction={transaction.id} onClick={() => onEdit(transaction)}>Düzelt</button>
                      <button
                        type="button"
                        className="danger-link"
                        data-delete-transaction={transaction.id}
                        onClick={() => setTransactionToDelete(transaction)}
                      >Sil</button>
                    </>
                  ) : <small>Sistem kaydı</small>}
                </span>
              </div>
            );
          })}
        </div>
        {rows.length === 0 ? <div className="empty-state" id="transaction-empty">Kayıt bulunamadı.</div> : null}
      </article>
      {transactionToDelete ? (
        <ConfirmDialog
          key={transactionToDelete.id}
          id="delete-transaction-dialog"
          open
          title="İşlemi sil"
          description={`“${transactionToDelete.title}” işlemini silmek istediğinizden emin misiniz?`}
          warning="Finansal kayıt fiziksel olarak silinmez. Bakiyeyi geri alan bir ters kayıt oluşturulacaktır."
          confirmLabel="Ters kayıtla sil"
          pendingLabel="İşlem siliniyor"
          errorFormatter={errorMessage}
          onClose={() => setTransactionToDelete(null)}
          onConfirm={() => onDelete(transactionToDelete)}
        />
      ) : null}
    </section>
  );
}
