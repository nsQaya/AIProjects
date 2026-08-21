import { useState, type CSSProperties } from "react";
import type { AccountTypeDTO } from "@defterx/contracts";

import { Button, InlineFeedback } from "../../components/ui";
import { errorMessage } from "../../lib/error-message";
import { money, toNumber } from "../../lib/format";
import { AccountDialog } from "./AccountDialog";
import type { AccountViewModel, AccountsPageCallbacks } from "./account-types";

const DEFAULT_ACCOUNT_SYMBOL = "▥";

export interface AccountsPageProps extends AccountsPageCallbacks {
  accounts: readonly AccountViewModel[];
  accountTypes: readonly AccountTypeDTO[];
  busy?: boolean;
  confirmDelete?: (account: AccountViewModel) => boolean | Promise<boolean>;
}

export function AccountsPage({
  accounts,
  accountTypes,
  busy = false,
  confirmDelete = (account) =>
    globalThis.confirm(`“${account.name}” hesabı silinsin mi? Kullanılmışsa arşivlenecektir.`),
  onCreateAccount,
  onDeleteAccount,
  onUpdateAccount,
}: AccountsPageProps) {
  const [editingAccount, setEditingAccount] = useState<AccountViewModel | null | undefined>();
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [pageFeedback, setPageFeedback] = useState("");
  const total = accounts
    .filter((account) => !account.isArchived)
    .reduce((sum, account) => sum + toNumber(account.displayBalance), 0);

  const deleteAccount = async (account: AccountViewModel) => {
    if (account.isArchived || busy || deletingAccountId !== null) return;
    if (!(await confirmDelete(account))) return;

    setPageFeedback("");
    setDeletingAccountId(account.id);
    try {
      await onDeleteAccount(account.id, account.version);
    } catch (error) {
      setPageFeedback(errorMessage(error));
    } finally {
      setDeletingAccountId(null);
    }
  };

  return (
    <section className="page-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow">Varlıklar ve borçlar</p>
          <h2>{money(total)}</h2>
          <span>Canlı net hesap bakiyesi</span>
        </div>
        <Button
          disabled={busy}
          id="open-account-dialog"
          variant="secondary"
          onClick={() => setEditingAccount(null)}
        >
          + Hesap ekle
        </Button>
      </div>

      {pageFeedback ? <InlineFeedback tone="error">{pageFeedback}</InlineFeedback> : null}

      <div className="account-grid">
        {accounts.length === 0 ? (
          <div className="empty-state">Henüz hesap tanımlanmadı.</div>
        ) : (
          accounts.map((account) => {
            const balance = toNumber(account.displayBalance);
            const style = {
              "--account": account.allowNegativeBalance ? "#ad5048" : "#287b60",
            } as CSSProperties;

            return (
              <article
                key={account.id}
                className={`account-card${account.isArchived ? " archived" : ""}`}
                style={style}
              >
                <div className="account-top">
                  <span className="account-symbol" aria-hidden="true">
                    {account.accountTypeIcon ?? DEFAULT_ACCOUNT_SYMBOL}
                  </span>
                  <span className="row-actions">
                    <button
                      data-edit-account={account.id}
                      disabled={busy || deletingAccountId !== null}
                      type="button"
                      onClick={() => setEditingAccount(account)}
                    >
                      Düzenle
                    </button>
                    <button
                      className="danger-link"
                      data-delete-account={account.id}
                      disabled={account.isArchived || busy || deletingAccountId !== null}
                      type="button"
                      onClick={() => void deleteAccount(account)}
                    >
                      {account.isArchived
                        ? "Arşivli"
                        : deletingAccountId === account.id
                          ? "İşleniyor…"
                          : "Sil"}
                    </button>
                  </span>
                </div>

                <div>
                  <small>
                    {account.accountTypeName}
                    {account.isArchived ? " · Arşivli" : ""}
                  </small>
                  <h3>{account.name}</h3>
                </div>

                <strong className={balance < 0 ? "expense" : undefined}>
                  {money(account.displayBalance)}
                </strong>
                <small>
                  {account.creditLimit !== null
                    ? `Limit ${money(account.creditLimit)}${
                        account.availableCredit !== null
                          ? ` · Kullanılabilir ${money(account.availableCredit)}`
                          : ""
                      }`
                    : account.allowNegativeBalance
                      ? "Eksi bakiyeye izin verilir"
                      : "Eksi bakiyeye kapalı"}
                </small>
                <div className="account-line"><span /></div>
              </article>
            );
          })
        )}
      </div>

      {editingAccount !== undefined ? (
        <AccountDialog
          key={editingAccount?.id ?? "new-account"}
          account={editingAccount}
          accountTypes={accountTypes}
          onClose={() => setEditingAccount(undefined)}
          onCreate={onCreateAccount}
          onUpdate={onUpdateAccount}
        />
      ) : null}
    </section>
  );
}
