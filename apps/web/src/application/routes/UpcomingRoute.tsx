import { useState } from "react";

import type { ScheduledTransactionView } from "../../finance";
import { ScheduledDialog } from "../../modules/upcoming/ScheduledDialog";
import type { ScheduledDraft } from "../../modules/upcoming/scheduled-types";
import { UpcomingPage } from "../../modules/upcoming/UpcomingPage";
import { useFinance } from "../../providers/FinanceProvider";

export function UpcomingRoute() {
  const { mutate, service, snapshot } = useFinance();
  const [editing, setEditing] = useState<ScheduledTransactionView | null | undefined>();

  const save = async (draft: ScheduledDraft, item: ScheduledTransactionView | null) => {
    if (item) {
      await mutate(
        () => service.updateScheduled(item.id, {
          accountId: draft.accountId,
          targetAccountId: draft.targetAccountId,
          transactionType: draft.transactionType,
          categoryId: draft.categoryId,
          costCenterId: draft.costCenterId,
          title: draft.title,
          amount: draft.amount,
          scheduledAt: draft.scheduledAt,
          version: item.version,
        }),
        "Plan güncellendi.",
      );
      return;
    }
    await mutate(() => service.createScheduled(draft), "Planlı işlem eklendi.");
  };

  return (
    <>
      <UpcomingPage
        items={snapshot.upcoming}
        onNew={() => setEditing(null)}
        onEdit={(item) => setEditing(item)}
        onDelete={async (item) => {
          await mutate(() => service.deleteScheduled(item.id, item.version), "Planlı işlem silindi.");
        }}
        onRealize={async (item) => {
          await mutate(
            () => service.realizeScheduled(item.id, item.version),
            "Planlı kayıt işlemlere aktarıldı.",
          );
        }}
      />
      {editing !== undefined ? (
        <ScheduledDialog
          accounts={snapshot.accounts}
          categories={snapshot.categories}
          costCenters={snapshot.costCenters}
          item={editing}
          onClose={() => setEditing(undefined)}
          onSave={save}
          open
        />
      ) : null}
    </>
  );
}
