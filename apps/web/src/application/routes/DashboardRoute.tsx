import { DashboardPage } from "../../modules/dashboard";
import { useFinance } from "../../providers/FinanceProvider";

export function DashboardRoute() {
  const { service, snapshot } = useFinance();

  return (
    <DashboardPage
      busy={snapshot.refreshing}
      snapshot={snapshot}
      onCashflowRangeChange={(range) => service.loadCashflow(range)}
      onCashflowAccountsChange={(accountIds) => service.loadCashflowAccounts(accountIds)}
      onCashflowVisibilityChange={(visibility) => service.setCashflowVisibility(visibility)}
    />
  );
}
