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

export interface TransactionDialogProps {
  accounts: readonly AccountView[];
  categories: readonly CategoryDTO[];
  costCenters: readonly CostCenterDTO[];
  onClose: () => void;
  onSave: (draft: TransactionDraft, transaction: TransactionView | null) => Promise<void>;
  open: boolean;
  transaction: TransactionView | null;
}

export interface TransactionLedgerFilter {
  accountIds: readonly UUID[];
  costCenterId?: UUID;
  from: string;
  to: string;
}
