import { useMemo } from "react";

import { PageTour } from "../../layouts/PageTour";
import { ACCOUNTS_PAGE_TOUR } from "../../layouts/page-tours";
import { useFinance } from "../../providers/FinanceProvider";
import { AccountsPage } from "../../modules/accounts";
import type { AccountSharingApi } from "../../modules/accounts";

export function AccountsRoute() {
  const { mutate, mutationBusy, service, snapshot } = useFinance();

  const sharing = useMemo<AccountSharingApi>(
    () => ({
      sharedAccounts: snapshot.sharedAccounts,
      listShares: (accountId) => service.listAccountShares(accountId).then((response) => response.items),
      shareAccount: (accountId, values) =>
        mutate(() => service.shareAccount(accountId, values), "Hesap paylaşıldı."),
      updateShare: (accountId, shareId, values) =>
        mutate(() => service.updateAccountShare(accountId, shareId, values), "Paylaşım yetkisi güncellendi."),
      revokeShare: (accountId, shareId) =>
        mutate(() => service.revokeAccountShare(accountId, shareId), "Paylaşım kaldırıldı."),
      loadSharedTransactions: (accountId, ownerBookId) =>
        service.loadSharedAccountTransactions(accountId, ownerBookId),
      loadPostingContext: (accountId) => service.loadAccountPostingContext(accountId),
      createSharedTransaction: (ownerBookId, accountId, currencyCode, draft) =>
        mutate(
          () =>
            service.createSharedAccountTransaction(ownerBookId, {
              type: draft.type,
              title: draft.title,
              amount: draft.amount,
              accountId,
              currencyCode,
              categoryId: draft.categoryId,
              ...(draft.costCenterId ? { costCenterId: draft.costCenterId } : {}),
              transactionDate: draft.transactionDate,
            }),
          "İşlem kaydedildi.",
        ),
    }),
    [mutate, service, snapshot.sharedAccounts],
  );

  return (
    <>
    <PageTour page="accounts" steps={ACCOUNTS_PAGE_TOUR} />
    <AccountsPage
      accounts={snapshot.accounts}
      accountTypes={snapshot.accountTypes.filter((accountType) => accountType.isActive)}
      currencies={snapshot.currencies}
      busy={mutationBusy}
      sharing={sharing}
      loadStatement={(accountId, period) => service.loadAccountStatement(accountId, period)}
      onCreateAccount={(values) =>
        mutate(
          () => service.createAccount({ ...values, isArchived: false, sortOrder: 0 }),
          "Hesap eklendi.",
        )
      }
      onUpdateAccount={(id, values) =>
        mutate(() => service.updateAccount(id, values), "Hesap güncellendi.")
      }
      onDeleteAccount={(id, version) =>
        mutate(() => service.deleteAccount(id, version), "Hesap silindi veya arşivlendi.")
      }
    />
    </>
  );
}
