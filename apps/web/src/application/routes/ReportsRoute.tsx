import { lazy, Suspense } from "react";

import { LoadingState } from "../../components/ui";
import { PageTour } from "../../layouts/PageTour";
import { REPORTS_PAGE_TOUR } from "../../layouts/page-tours";
import { useFinance } from "../../providers/FinanceProvider";
import { useReportSections } from "../../modules/reports/useReportSections";
import { useToast } from "../ToastProvider";

// Lazy-loaded on its own (large chart/export dependencies) - keep this the
// only eager import from "../../modules/reports" so that boundary holds.
const ReportsPage = lazy(() =>
  import("../../modules/reports").then((module) => ({ default: module.ReportsPage })),
);

export function ReportsRoute() {
  const { snapshot, service } = useFinance();
  const { showToast } = useToast();
  const { sections, apply } = useReportSections((range) => service.loadReportAnalyticsSnapshot(range));

  return (
    <Suspense fallback={<LoadingState />}>
      <PageTour page="reports" steps={REPORTS_PAGE_TOUR} />
      <ReportsPage
        accounts={snapshot.accounts}
        busy={snapshot.refreshing}
        sections={sections}
        onApply={apply}
        onNotify={showToast}
      />
    </Suspense>
  );
}
