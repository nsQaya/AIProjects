import { useState } from "react";

import type { ScheduledTransactionView } from "../../finance";
import { TransactionDialog } from "../../modules/transactions/TransactionDialog";
import { ScheduledDialog } from "../../modules/upcoming/ScheduledDialog";
import type { ScheduledDraft } from "../../modules/upcoming/scheduled-types";
import { UpcomingPage } from "../../modules/upcoming/UpcomingPage";
import { useFinance } from "../../providers/FinanceProvider";

const DIALOG_REALIZABLE = ["INCOME", "EXPENSE", "TRANSFER"] as const;
type DialogRealizable = (typeof DIALOG_REALIZABLE)[number];

const isDialogRealizable = (
  item: ScheduledTransactionView,
): item is ScheduledTransactionView & { transactionType: DialogRealizable } =>
  (DIALOG_REALIZABLE as readonly string[]).includes(item.transactionType);

export function UpcomingRoute() {
  const { mutate, service, snapshot } = useFinance();
  const [editing, setEditing] = useState<ScheduledTransactionView | null | undefined>();
  const [realizing, setRealizing] = useState<
    (ScheduledTransactionView & { transactionType: DialogRealizable }) | null
  >(null);

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
        accounts={snapshot.accounts}
        items={snapshot.upcoming}
        onNew={() => setEditing(null)}
        onEdit={(item) => setEditing(item)}
        onDelete={async (item) => {
          await mutate(() => service.deleteScheduled(item.id, item.version), "Planlı işlem silindi.");
        }}
        onRealize={async (item) => {
          if (isDialogRealizable(item)) {
            setRealizing(item);
            return;
          }
          if (!globalThis.confirm(`“${item.title}” gerçekleşti olarak işlemlere aktarılsın mı?`)) return;
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
      {realizing ? (
        <TransactionDialog
          accounts={snapshot.accounts}
          categories={snapshot.categories}
          costCenters={snapshot.costCenters}
          transaction={null}
          prefill={{
            type: realizing.transactionType,
            title: realizing.title,
            amount: realizing.amount,
            accountId: realizing.accountId,
            targetAccountId: realizing.targetAccountId ?? undefined,
            categoryId: realizing.categoryId ?? undefined,
            costCenterId: realizing.costCenterId ?? undefined,
            // Date defaults to today (bills are usually realized late); still editable.
          }}
          title="Planı gerçekleştir"
          open
          onClose={() => setRealizing(null)}
          onSave={async (draft) => {
            await mutate(
              () => service.realizeScheduled(realizing.id, realizing.version, {
                transactionType: draft.type,
                title: draft.title,
                amount: draft.amount,
                accountId: draft.accountId,
                targetAccountId: draft.targetAccountId ?? null,
                categoryId: draft.categoryId ?? null,
                costCenterId: draft.costCenterId ?? null,
                transactionDate: draft.transactionDate,
              }),
              "Yaklaşan işlem gerçekleşti olarak kaydedildi.",
            );
          }}
        />
      ) : null}
    </>
  );
}
