import { useEffect, useState, type CSSProperties } from "react";

import { Dialog, DialogHeader, InlineFeedback } from "../../components/ui";
import { errorMessage } from "../../lib/error-message";
import { dateText, money, moneyInCurrency, signedMoney } from "../../lib/format";
import type { SharedAccountView, TransactionView } from "../../finance/finance-views";
import { SharedAccountTransactionDialog } from "./SharedAccountTransactionDialog";
import type { AccountSharingApi } from "./account-types";

const DEFAULT_ACCOUNT_SYMBOL = "▥";

interface SharedAccountsSectionProps {
  accounts: readonly SharedAccountView[];
  sharing: AccountSharingApi;
  busy?: boolean;
  confirmLeave?: (account: SharedAccountView) => boolean | Promise<boolean>;
}

export function SharedAccountsSection({
  accounts,
  sharing,
  busy = false,
  confirmLeave = (account) =>
    globalThis.confirm(`“${account.name}” hesabının paylaşımını durdurmak istediğine emin misin?`),
}: SharedAccountsSectionProps) {
  const [ledgerAccount, setLedgerAccount] = useState<SharedAccountView | null>(null);
  const [postingAccount, setPostingAccount] = useState<SharedAccountView | null>(null);
  const [leavingShareId, setLeavingShareId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");

  const leaveShare = async (account: SharedAccountView) => {
    if (busy || leavingShareId !== null) return;
    if (!(await confirmLeave(account))) return;

    setFeedback("");
    setLeavingShareId(account.shareId);
    try {
      await sharing.revokeShare(account.id, account.shareId);
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setLeavingShareId(null);
    }
  };

  if (accounts.length === 0) return null;

  return (
    <section className="page-section shared-accounts">
      <div className="section-intro">
        <div>
          <p className="eyebrow">Benimle paylaşılanlar</p>
          <span>Başka kullanıcıların sana açtığı hesaplar. Kendi toplamlarına dâhil değildir.</span>
        </div>
      </div>

      {feedback ? <InlineFeedback tone="error">{feedback}</InlineFeedback> : null}

      <div className="account-grid">
        {accounts.map((account) => {
          const style = { "--account": "#4a5b8c" } as CSSProperties;
          return (
            <article
              key={account.shareId}
              className={`account-card${account.isArchived ? " archived" : ""}`}
              style={style}
            >
              <div className="account-top">
                <span className="account-symbol" aria-hidden="true">
                  {account.accountTypeIcon ?? DEFAULT_ACCOUNT_SYMBOL}
                </span>
                <span className="badge">
                  {account.permission === "OPERATE" ? "İşlem yapabilir" : "Görüntüleme"}
                </span>
              </div>

              <div>
                <small>
                  {account.ownerName} · {account.accountTypeName}
                  {account.isArchived ? " · Arşivli" : ""}
                </small>
                <h3>{account.name}</h3>
              </div>

              <div className="account-balance">
                <strong className={account.ui.displayBalance < 0 ? "expense" : undefined}>
                  {account.currencyCode === "TRY"
                    ? money(account.displayBalance)
                    : moneyInCurrency(account.displayBalance, account.currencyCode)}
                </strong>
                {account.currencyCode !== "TRY" ? (
                  <span className="account-balance-try">≈ {money(account.displayBalanceTry)}</span>
                ) : null}
              </div>

              <span className="row-actions">
                <button type="button" onClick={() => setLedgerAccount(account)}>
                  Hareketler
                </button>
                {account.permission === "OPERATE" && !account.isArchived ? (
                  <button type="button" disabled={busy} onClick={() => setPostingAccount(account)}>
                    İşlem ekle
                  </button>
                ) : null}
                <button
                  type="button"
                  className="danger-link"
                  disabled={busy || leavingShareId !== null}
                  onClick={() => void leaveShare(account)}
                >
                  {leavingShareId === account.shareId ? "İşleniyor…" : "Paylaşımı durdur"}
                </button>
              </span>
              <div className="account-line"><span /></div>
            </article>
          );
        })}
      </div>

      {ledgerAccount ? (
        <SharedAccountLedgerDialog
          account={ledgerAccount}
          loadTransactions={sharing.loadSharedTransactions}
          onClose={() => setLedgerAccount(null)}
        />
      ) : null}

      {postingAccount ? (
        <SharedAccountTransactionDialog
          account={postingAccount}
          sharing={sharing}
          onClose={() => setPostingAccount(null)}
        />
      ) : null}
    </section>
  );
}

interface SharedAccountLedgerDialogProps {
  account: SharedAccountView;
  loadTransactions: AccountSharingApi["loadSharedTransactions"];
  onClose: () => void;
}

function SharedAccountLedgerDialog({ account, loadTransactions, onClose }: SharedAccountLedgerDialogProps) {
  const [rows, setRows] = useState<readonly TransactionView[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadTransactions(account.id, account.ownerBookId)
      .then((items) => {
        if (active) setRows(items);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, [account.id, account.ownerBookId, loadTransactions]);

  return (
    <Dialog id="shared-account-ledger-dialog" open onClose={onClose}>
      <DialogHeader eyebrow={`${account.ownerName} · ${account.name}`} title="Hesap hareketleri" />
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
      {rows === null ? (
        <p className="muted">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="muted">Bu hesapta hareket yok.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Açıklama</th>
              <th className="numeric">Tutar</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{dateText(row.transactionDate)}</td>
                <td>
                  {row.title}
                  {row.categoryName ? <small> · {row.categoryName}</small> : null}
                </td>
                <td className="numeric">
                  {account.currencyCode === "TRY"
                    ? signedMoney(row.ui.amount, row.ui.kind)
                    : moneyInCurrency(String(row.ui.amount), account.currencyCode)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Dialog>
  );
}
