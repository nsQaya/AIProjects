import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "../auth/AuthProvider";
import { Button, InlineFeedback, LoadingState } from "../components/ui";
import type { TransactionView } from "../finance";
import { AppLayout } from "../layouts/AppLayout";
import { TransactionDialog } from "../modules/transactions/TransactionDialog";
import type { TransactionDraft } from "../modules/transactions/transaction-types";
import { useFinance } from "../providers/FinanceProvider";
import { errorMessage } from "../lib/error-message";
import { AccountsRoute } from "./routes/AccountsRoute";
import { DashboardRoute } from "./routes/DashboardRoute";
import { InvestmentsRoute } from "./routes/InvestmentsRoute";
import { ReportsRoute } from "./routes/ReportsRoute";
import { SettingsRoute } from "./routes/SettingsRoute";
import { TransactionsRoute } from "./routes/TransactionsRoute";
import { UpcomingRoute } from "./routes/UpcomingRoute";

export function AuthenticatedApp() {
  const { completeOnboarding, logout, session } = useAuth();
  const { apiStatus, initializationError, mutate, mutationBusy, refresh, service, snapshot } = useFinance();
  const [transactionEditor, setTransactionEditor] = useState<TransactionView | null | undefined>();
  const [tourDismissedLocally, setTourDismissedLocally] = useState(false);

  if (!session) return null;

  const showOnboardingTour = !tourDismissedLocally && !session.user.onboardingCompletedAt;
  const finishOnboardingTour = () => {
    setTourDismissedLocally(true);
    void completeOnboarding().catch(() => {});
  };

  const saveTransaction = async (draft: TransactionDraft, transaction: TransactionView | null) => {
    if (transaction) {
      await mutate(() => service.correctTransaction(transaction.id, draft), "İşlem düzeltildi.");
    } else if (draft.installmentCount && draft.installmentCount >= 2 && draft.fundingAccountId) {
      const { installmentCount, fundingAccountId, categoryId, costCenterId, accountId, title, amount, transactionDate } = draft;
      if (!categoryId) throw new Error("Taksitli harcama için kategori gerekli.");
      await mutate(
        () => service.createInstallmentExpense({
          accountId,
          fundingAccountId,
          categoryId,
          ...(costCenterId ? { costCenterId } : {}),
          title,
          amount,
          transactionDate,
          installmentCount,
        }),
        "Taksitli harcama kaydedildi.",
      );
    } else {
      await mutate(() => service.createTransaction(draft), "İşlem kaydedildi.");
    }
  };

  const content = snapshot.phase !== "ready" ? (
    <section className="page-section">
      <LoadingState loading={!initializationError} />
      {initializationError ? (
        <article className="panel">
          <InlineFeedback tone="error">{errorMessage(initializationError)}</InlineFeedback>
          <Button onClick={() => void refresh()}>Yeniden dene</Button>
        </article>
      ) : null}
    </section>
  ) : (
    <Routes>
      <Route path="/dashboard" element={<DashboardRoute />} />
      <Route path="/transactions" element={<TransactionsRoute onEdit={(transaction) => setTransactionEditor(transaction)} />} />
      <Route path="/accounts" element={<AccountsRoute />} />
      <Route path="/savings" element={<InvestmentsRoute />} />
      <Route path="/upcoming" element={<UpcomingRoute />} />
      <Route path="/reports" element={<ReportsRoute />} />
      <Route path="/settings" element={<SettingsRoute />} />
      <Route path="*" element={<Navigate replace to="/dashboard" />} />
    </Routes>
  );

  return (
    <AppLayout
      apiStatus={apiStatus}
      bookName={snapshot.book?.name ?? "Kişisel Defter"}
      busy={snapshot.refreshing || mutationBusy}
      user={session.user}
      onLogout={logout}
      onNewTransaction={() => setTransactionEditor(null)}
      onOnboardingTourFinish={finishOnboardingTour}
      onSync={refresh}
      showOnboardingTour={showOnboardingTour}
      transactionDialog={
        transactionEditor !== undefined ? (
          <TransactionDialog
            accounts={snapshot.accounts}
            categories={snapshot.categories}
            costCenters={snapshot.costCenters}
            onClose={() => setTransactionEditor(undefined)}
            onSave={saveTransaction}
            open
            transaction={transactionEditor}
          />
        ) : null
      }
    >
      {content}
    </AppLayout>
  );
}
