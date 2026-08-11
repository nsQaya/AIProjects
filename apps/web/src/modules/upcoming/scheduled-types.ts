import type { CategoryDTO, CostCenterDTO, ScheduledRecurrenceFrequency, UUID } from "@defterx/contracts";
import type { AccountView, ScheduledTransactionView } from "../../finance/finance-views";

export type ScheduledFormKind = "income" | "expense" | "transfer";
export type ScheduledRepeat = "NONE" | ScheduledRecurrenceFrequency;

export interface ScheduledDraft {
  accountId: UUID;
  targetAccountId: UUID | null;
  transactionType: "INCOME" | "EXPENSE" | "TRANSFER";
  categoryId: UUID | null;
  costCenterId: UUID | null;
  title: string;
  amount: string;
  scheduledAt: string;
  recurrence?: {
    frequency: ScheduledRecurrenceFrequency;
    interval: number;
    until: string;
  };
}

export interface ScheduledDialogProps {
  accounts: readonly AccountView[];
  categories: readonly CategoryDTO[];
  costCenters: readonly CostCenterDTO[];
  item: ScheduledTransactionView | null;
  onClose: () => void;
  onSave: (draft: ScheduledDraft, item: ScheduledTransactionView | null) => Promise<void>;
  open: boolean;
}
