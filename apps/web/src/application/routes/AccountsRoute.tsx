import { useFinance } from "../../providers/FinanceProvider";
import { AccountsPage } from "../../modules/accounts";

export function AccountsRoute() {
  const { mutate, mutationBusy, service, snapshot } = useFinance();

  return (
    <AccountsPage
      accounts={snapshot.accounts}
      accountTypes={snapshot.accountTypes.filter((accountType) => accountType.isActive)}
      busy={mutationBusy}
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
  );
}
