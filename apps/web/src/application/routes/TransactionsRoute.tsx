import type { TransactionView } from "../../finance";
import { TransactionsPage } from "../../modules/transactions/TransactionsPage";
import { useFinance } from "../../providers/FinanceProvider";
import { useToast } from "../ToastProvider";

export function TransactionsRoute({ onEdit }: { onEdit: (transaction: TransactionView) => void }) {
  const { mutate, service, snapshot } = useFinance();
  const { showToast } = useToast();

  return (
    <TransactionsPage
      accounts={snapshot.accounts}
      categories={snapshot.categories}
      costCenters={snapshot.costCenters}
      loading={snapshot.refreshing}
      openingBalance={snapshot.transactionOpeningBalance}
      transactions={snapshot.transactions}
      onNotify={showToast}
      onEdit={onEdit}
      onDelete={async (transaction) => {
        await mutate(
          () => service.deleteTransaction(transaction.id),
          "İşlem silindi ve ters kayıt oluşturuldu.",
        );
      }}
      onLedgerFilterChange={(filter) => service.loadTransactions(filter).then(() => undefined)}
      onCreateFxConversion={(values) =>
        mutate(() => service.createFxConversion(values), "Döviz işlemi kaydedildi.")
      }
    />
  );
}
