import { lazy, Suspense, useState } from "react";
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
import { SettingsRoute } from "./routes/SettingsRoute";
import { TransactionsRoute } from "./routes/TransactionsRoute";
import { UpcomingRoute } from "./routes/UpcomingRoute";

const ReportsPage = lazy(() =>
  import("../modules/reports").then((module) => ({ default: module.ReportsPage })),
);

export function AuthenticatedApp() {
  const { logout, session } = useAuth();
  const { apiStatus, initializationError, mutate, mutationBusy, refresh, service, snapshot } = useFinance();
  const [transactionEditor, setTransactionEditor] = useState<TransactionView | null | undefined>();

  if (!session) return null;

  const saveTransaction = async (draft: TransactionDraft, transaction: TransactionView | null) => {
    if (transaction) {
      await mutate(() => service.correctTransaction(transaction.id, draft), "İşlem düzeltildi.");
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
      <Route
        path="/reports"
        element={(
          <Suspense fallback={<LoadingState />}>
            <ReportsPage
              accounts={snapshot.accounts}
              analytics={snapshot.reportAnalytics}
              busy={snapshot.refreshing}
              loadFailed={snapshot.reportLoadFailed}
              range={snapshot.reportRange}
              onFilterChange={(filter) => service.loadReportAnalytics(filter)}
            />
          </Suspense>
        )}
      />
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
      onSync={refresh}
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
