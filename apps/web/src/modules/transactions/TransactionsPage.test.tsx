import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CategoryDTO, CostCenterDTO } from "@defterx/contracts";

import type { AccountView, TransactionView } from "../../finance/finance-views";
import { downloadCsv } from "../../lib/csv";
import { money } from "../../lib/format";
import type { TransactionLedgerFilter } from "./transaction-types";
import { TransactionsPage } from "./TransactionsPage";

vi.mock("../../lib/csv", async () => {
  const actual = await vi.importActual("../../lib/csv");
  return { ...actual, downloadCsv: vi.fn() };
});

const BOOK_ID = "00000000-0000-4000-8000-000000000001";
const BANK_ID = "00000000-0000-4000-8000-000000000002";
const CASH_ID = "00000000-0000-4000-8000-000000000003";
const INCOME_CATEGORY_ID = "00000000-0000-4000-8000-000000000004";
const EXPENSE_CATEGORY_ID = "00000000-0000-4000-8000-000000000005";
const INCOME_ID = "00000000-0000-4000-8000-000000000006";
const EXPENSE_ID = "00000000-0000-4000-8000-000000000007";
const COST_CENTER_ID = "00000000-0000-4000-8000-000000000008";

const accounts: readonly AccountView[] = [
  account(BANK_ID, "Banka", "Banka"),
  account(CASH_ID, "Nakit", "Nakit"),
];

const categories: readonly CategoryDTO[] = [
  category(INCOME_CATEGORY_ID, "Maaş", "INCOME"),
  category(EXPENSE_CATEGORY_ID, "Market", "EXPENSE"),
];

const costCenters: readonly CostCenterDTO[] = [
  {
    id: COST_CENTER_ID,
    bookId: BOOK_ID,
    name: "Aile arabası",
    description: "Ortak araç giderleri",
    sortOrder: 10,
    isActive: true,
    version: 1,
  },
];

const transactions: readonly TransactionView[] = [
  transaction({
    id: INCOME_ID,
    type: "INCOME",
    title: "Ağustos maaşı",
    accountId: BANK_ID,
    accountName: "Banka",
    categoryId: INCOME_CATEGORY_ID,
    categoryName: "Maaş",
    date: "2026-08-05",
    amount: "1000.00",
    balanceDelta: "1000.00",
    runningBalance: "1200.25",
    uiRunningBalance: -9000,
  }),
  transaction({
    id: EXPENSE_ID,
    type: "EXPENSE",
    title: "Haftalık market",
    accountId: CASH_ID,
    accountName: "Nakit",
    categoryId: EXPENSE_CATEGORY_ID,
    categoryName: "Market",
    date: "2026-08-06",
    amount: "80.00",
    balanceDelta: "-80.00",
    runningBalance: "1120.25",
    uiRunningBalance: -8000,
    costCenterId: COST_CENTER_ID,
    costCenterName: "Aile arabası",
  }),
];

function account(
  id: string,
  name: string,
  accountTypeName: string,
): AccountView {
  return {
    id,
    bookId: BOOK_ID,
    contactId: null,
    name,
    accountTypeId: `type-${accountTypeName.toLowerCase()}`,
    accountTypeName,
    accountTypeIcon: null,
    isInvestment: false,
    normalBalance: "DEBIT",
    currencyCode: "TRY",
    allowNegativeBalance: false,
    creditLimit: null,
    isArchived: false,
    sortOrder: 0,
    version: 1,
    balance: "0",
    displayBalance: "0",
    displayBalanceTry: "0",
    openingBalance: "0",
    availableCredit: null,
    ui: {
      balance: 0,
      displayBalance: 0,
      creditLimit: null,
      availableCredit: null,
    },
  };
}

function category(
  id: string,
  name: string,
  categoryType: CategoryDTO["categoryType"],
): CategoryDTO {
  return {
    id,
    bookId: BOOK_ID,
    parentId: null,
    name,
    categoryType,
    icon: null,
    sortOrder: 0,
    isSystem: false,
    isActive: true,
    version: 1,
  };
}

interface TransactionFixtureInput {
  id: string;
  type: "INCOME" | "EXPENSE";
  title: string;
  accountId: string;
  accountName: string;
  categoryId: string;
  categoryName: string;
  date: string;
  amount: string;
  balanceDelta: string;
  runningBalance: string;
  uiRunningBalance: number;
  costCenterId?: string;
  costCenterName?: string;
}

function transaction(input: TransactionFixtureInput): TransactionView {
  return {
    id: input.id,
    transactionNo: input.type === "INCOME" ? "1" : "2",
    type: input.type,
    accountId: input.accountId,
    accountName: input.accountName,
    targetAccountId: null,
    targetAccountName: null,
    title: input.title,
    description: null,
    transactionDate: `${input.date}T12:00:00.000Z`,
    dueDate: null,
    status: "POSTED",
    currencyCode: "TRY",
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    costCenterId: input.costCenterId ?? null,
    costCenterName: input.costCenterName ?? null,
    contactId: null,
    version: 1,
    amount: input.amount,
    balanceDelta: input.balanceDelta,
    runningBalance: input.runningBalance,
    ui: {
      kind: input.type.toLowerCase() as "income" | "expense",
      description: input.title,
      date: input.date,
      amount: Number(input.amount),
      balanceDelta: Number(input.balanceDelta),
      runningBalance: input.uiRunningBalance,
    },
  };
}

function renderPage(options: {
  onDelete?: (transaction: TransactionView) => Promise<void>;
} = {}) {
  const onLedgerFilterChange = vi.fn<
    (filter: TransactionLedgerFilter) => Promise<void>
  >();
  onLedgerFilterChange.mockResolvedValue(undefined);
  const onNotify = vi.fn<(message: string) => void>();
  const onDelete = options.onDelete ?? vi.fn().mockResolvedValue(undefined);

  const result = render(
    <TransactionsPage
      accounts={accounts}
      categories={categories}
      costCenters={costCenters}
      onDelete={onDelete}
      onEdit={vi.fn()}
      onLedgerFilterChange={onLedgerFilterChange}
      onNotify={onNotify}
      openingBalance="200.25"
      transactions={transactions}
    />,
  );

  return { ...result, onDelete, onLedgerFilterChange, onNotify };
}

beforeEach(() => {
  vi.mocked(downloadCsv).mockClear();
});

describe("TransactionsPage ledger controls", () => {
  it("sends the remaining account IDs when a user changes the multi-account filter", async () => {
    const user = userEvent.setup();
    const { onLedgerFilterChange } = renderPage();

    await user.click(screen.getByText("Hesaplar"));
    expect(screen.getByRole("checkbox", { name: "Tüm hesaplar" })).toBeChecked();

    await user.click(screen.getByRole("checkbox", { name: "Nakit" }));

    await waitFor(() => {
      expect(onLedgerFilterChange).toHaveBeenLastCalledWith({
        accountIds: [BANK_ID],
        from: "",
        to: "",
      });
    });
  });

  it("adds a carry row for a start date and displays server-authored balances", async () => {
    const user = userEvent.setup();
    const { container, onLedgerFilterChange } = renderPage();

    await user.type(screen.getByLabelText("Başlangıç"), "2026-08-01");

    await waitFor(() => {
      expect(onLedgerFilterChange).toHaveBeenLastCalledWith({
        accountIds: [BANK_ID, CASH_ID],
        from: "2026-08-01",
        to: "",
      });
    });

    const carryRow = container.querySelector<HTMLElement>("[data-carry-row]");
    const incomeRow = container.querySelector<HTMLElement>(`[data-transaction-id="${INCOME_ID}"]`);
    expect(carryRow).not.toBeNull();
    expect(incomeRow).not.toBeNull();
    expect(within(carryRow!).getByText("Devir")).toBeInTheDocument();
    expect(carryRow).toHaveTextContent(money("200.25"));
    expect(within(incomeRow!).getByText(money("1200.25"))).toHaveClass("running-balance");

    const ledgerChildren = Array.from(container.querySelector("#all-transactions")!.children);
    expect(ledgerChildren.indexOf(carryRow!)).toBeLessThan(ledgerChildren.indexOf(incomeRow!));
  });

  it("shows only the selected transaction type and updates the result count", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByLabelText("Tür", { selector: "select" }), "expense");

    expect(screen.queryByText("Ağustos maaşı")).not.toBeInTheDocument();
    expect(screen.getByText("Haftalık market")).toBeInTheDocument();
    expect(screen.getByText("1 kayıt bulundu")).toBeInTheDocument();
  });

  it("filters the ledger locally and at the API boundary by cost center", async () => {
    const user = userEvent.setup();
    const { onLedgerFilterChange } = renderPage();

    await user.selectOptions(screen.getByLabelText("Masraf merkezi"), COST_CENTER_ID);

    await waitFor(() => {
      expect(onLedgerFilterChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ costCenterId: COST_CENTER_ID }),
      );
    });
    expect(screen.queryByText("Ağustos maaşı")).not.toBeInTheDocument();
    expect(screen.getByText("Haftalık market")).toBeInTheDocument();
    expect(screen.getByText("1 kayıt bulundu")).toBeInTheDocument();
  });

  it("exports the filtered rows with carry and server running-balance values", async () => {
    const user = userEvent.setup();
    const { onNotify } = renderPage();

    await user.type(screen.getByLabelText("Başlangıç"), "2026-08-01");
    await user.selectOptions(screen.getByLabelText("Tür", { selector: "select" }), "expense");
    await user.click(screen.getByRole("button", { name: "Dışa aktar (.csv)" }));

    expect(downloadCsv).toHaveBeenCalledOnce();
    const [filename, rows] = vi.mocked(downloadCsv).mock.calls[0]!;
    expect(filename).toMatch(/^defterx-islemler-\d{4}-\d{2}-\d{2}\.csv$/);
    expect(rows).toEqual([
      ["Tarih", "Tür", "Açıklama", "Kaynak hesap", "Hedef hesap", "Masraf merkezi", "Kategori", "Tutar", "Yürüyen bakiye"],
      ["2026-08-01", "devir", "Başlangıç öncesi devir", "", "", "", "", 0, "200.25"],
      ["2026-08-06", "expense", "Haftalık market", "Nakit", "", "Aile arabası", "Market", "-80.00", "1120.25"],
    ]);
    expect(onNotify).toHaveBeenCalledWith("1 işlem dışa aktarıldı.");
  });
});

describe("TransactionsPage delete confirmation", () => {
  it("uses the React confirmation and preserves the transaction delete callback", async () => {
    const user = userEvent.setup();
    const browserConfirm = vi.spyOn(globalThis, "confirm").mockReturnValue(true);
    const onDelete = vi.fn<(transaction: TransactionView) => Promise<void>>();
    onDelete.mockResolvedValue(undefined);
    const { container } = renderPage({ onDelete });

    await user.click(
      container.querySelector<HTMLButtonElement>(`[data-delete-transaction="${EXPENSE_ID}"]`)!,
    );
    let dialog = await screen.findByRole("dialog", { name: "İşlemi sil" });
    expect(within(dialog).getByText(/Haftalık market/)).toBeInTheDocument();
    expect(within(dialog).getByText(/ters kayıt oluşturulacaktır/)).toBeInTheDocument();
    expect(browserConfirm).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Vazgeç" }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "İşlemi sil" })).not.toBeInTheDocument();

    await user.click(
      container.querySelector<HTMLButtonElement>(`[data-delete-transaction="${EXPENSE_ID}"]`)!,
    );
    dialog = await screen.findByRole("dialog", { name: "İşlemi sil" });
    await user.click(within(dialog).getByRole("button", { name: "Ters kayıtla sil" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(transactions[1]));
    expect(screen.queryByRole("dialog", { name: "İşlemi sil" })).not.toBeInTheDocument();
    browserConfirm.mockRestore();
  });

  it("keeps a delete failure in the active confirmation dialog", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn<(transaction: TransactionView) => Promise<void>>();
    onDelete.mockRejectedValue(new Error("İşlem başka bir yerde değişti."));
    const { container } = renderPage({ onDelete });

    await user.click(
      container.querySelector<HTMLButtonElement>(`[data-delete-transaction="${INCOME_ID}"]`)!,
    );
    const dialog = await screen.findByRole("dialog", { name: "İşlemi sil" });
    await user.click(within(dialog).getByRole("button", { name: "Ters kayıtla sil" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "İşlem başka bir yerde değişti.",
    );
    expect(dialog).toHaveAttribute("open");
    expect(onDelete).toHaveBeenCalledWith(transactions[0]);
  });
});
