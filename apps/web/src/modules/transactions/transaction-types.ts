import type { CategoryDTO, CostCenterDTO, UUID } from "@defterx/contracts";
import type { AccountView, TransactionView } from "../../finance/finance-views";

export type TransactionFormKind = "income" | "expense" | "transfer";

export interface TransactionDraft {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  title: string;
  amount: string;
  accountId: UUID;
  targetAccountId?: UUID;
  categoryId?: UUID;
  costCenterId?: UUID;
  transactionDate: string;
}

/** Seeds the "new transaction" form (e.g. when realizing a scheduled plan). Ignored when `transaction` is set. */
export interface TransactionPrefill {
  type?: "INCOME" | "EXPENSE" | "TRANSFER";
  title?: string;
  amount?: string;
  accountId?: UUID;
  targetAccountId?: UUID;
  categoryId?: UUID;
  costCenterId?: UUID;
  /** ISO datetime or yyyy-mm-dd. */
  transactionDate?: string;
}

export interface TransactionDialogProps {
  accounts: readonly AccountView[];
  categories: readonly CategoryDTO[];
  costCenters: readonly CostCenterDTO[];
  onClose: () => void;
  onSave: (draft: TransactionDraft, transaction: TransactionView | null) => Promise<void>;
  open: boolean;
  transaction: TransactionView | null;
  prefill?: TransactionPrefill;
  /** Overrides the dialog header title. */
  title?: string;
}

export interface TransactionLedgerFilter {
  accountIds: readonly UUID[];
  costCenterId?: UUID;
  from: string;
  to: string;
}
