import { useState, type CSSProperties } from "react";
import type { AccountTypeDTO, CurrencyDTO } from "@defterx/contracts";

import { Button, InlineFeedback } from "../../components/ui";
import { errorMessage } from "../../lib/error-message";
import { money, moneyInCurrency, toNumber } from "../../lib/format";
import { AccountDialog } from "./AccountDialog";
import { AccountShareDialog } from "./AccountShareDialog";
import { SharedAccountsSection } from "./SharedAccountsSection";
import type { AccountSharingApi, AccountViewModel, AccountsPageCallbacks } from "./account-types";

const DEFAULT_ACCOUNT_SYMBOL = "▥";

export interface AccountsPageProps extends AccountsPageCallbacks {
  accounts: readonly AccountViewModel[];
  accountTypes: readonly AccountTypeDTO[];
  currencies?: readonly CurrencyDTO[];
  busy?: boolean;
  confirmDelete?: (account: AccountViewModel) => boolean | Promise<boolean>;
  /** Present in the real app; omit to render the page without sharing. */
  sharing?: AccountSharingApi;
}

export function AccountsPage({
  accounts,
  accountTypes,
  currencies = [],
  busy = false,
  confirmDelete = (account) =>
    globalThis.confirm(`“${account.name}” hesabı silinsin mi? Kullanılmışsa arşivlenecektir.`),
  sharing,
  onCreateAccount,
  onDeleteAccount,
  onUpdateAccount,
}: AccountsPageProps) {
  const [editingAccount, setEditingAccount] = useState<AccountViewModel | null | undefined>();
  const [sharingAccount, setSharingAccount] = useState<AccountViewModel | null>(null);
  const [deletingAccountId, setDeletingAccountId] = useState<string | null>(null);
  const [pageFeedback, setPageFeedback] = useState("");
  const total = accounts
    .filter((account) => !account.isArchived)
    .reduce((sum, account) => sum + toNumber(account.displayBalanceTry), 0);

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
    <>
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
                    {sharing && !account.isArchived ? (
                      <button
                        data-share-account={account.id}
                        disabled={busy || deletingAccountId !== null}
                        type="button"
                        onClick={() => setSharingAccount(account)}
                      >
                        Paylaş
                      </button>
                    ) : null}
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

                <div className="account-balance">
                  <strong className={balance < 0 ? "expense" : undefined}>
                    {account.currencyCode === "TRY"
                      ? money(account.displayBalance)
                      : moneyInCurrency(account.displayBalance, account.currencyCode)}
                  </strong>
                  {account.currencyCode !== "TRY" ? (
                    <span className="account-balance-try">
                      ≈ {money(account.displayBalanceTry)}
                    </span>
                  ) : null}
                </div>
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
          currencies={currencies}
          onClose={() => setEditingAccount(undefined)}
          onCreate={onCreateAccount}
          onUpdate={onUpdateAccount}
        />
      ) : null}

      {sharing && sharingAccount ? (
        <AccountShareDialog
          key={sharingAccount.id}
          account={{ id: sharingAccount.id, name: sharingAccount.name }}
          sharing={sharing}
          onClose={() => setSharingAccount(null)}
        />
      ) : null}
    </section>

    {sharing ? (
      <SharedAccountsSection accounts={sharing.sharedAccounts} sharing={sharing} busy={busy} />
    ) : null}
    </>
  );
}
