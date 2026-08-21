import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import type { AccountView, ScheduledTransactionView } from "../../finance/finance-views";
import { UpcomingPage } from "./UpcomingPage";

const BOOK_ID = "book-1";
const BANK_ID = "account-1";
const CASH_ID = "account-2";
const CARD_ID = "account-3";

function account(id: string, name: string, isCreditCard: boolean): AccountView {
  return {
    id,
    bookId: BOOK_ID,
    contactId: null,
    name,
    accountTypeId: isCreditCard ? "type-credit-card" : "type-cash",
    accountTypeName: name,
    accountTypeIcon: null,
    normalBalance: isCreditCard ? "CREDIT" : "DEBIT",
    currencyCode: "TRY",
    allowNegativeBalance: isCreditCard,
    creditLimit: isCreditCard ? "10000.00" : null,
    isArchived: false,
    sortOrder: 0,
    version: 1,
    balance: "0.00",
    displayBalance: "0.00",
    availableCredit: isCreditCard ? "10000.00" : null,
    ui: {
      balance: 0,
      displayBalance: 0,
      creditLimit: isCreditCard ? 10000 : null,
      availableCredit: isCreditCard ? 10000 : null,
    },
  };
}

const accounts: readonly AccountView[] = [
  account(BANK_ID, "Banka", false),
  account(CASH_ID, "Nakit", false),
  account(CARD_ID, "Kredi kartı", true),
];

interface ScheduledItemInput {
  accountId: string;
  date: string;
  id: string;
  status: ScheduledTransactionView["status"];
  targetAccountId?: string | null;
  title: string;
  transactionType: ScheduledTransactionView["transactionType"];
}

function scheduledItem(input: ScheduledItemInput): ScheduledTransactionView {
  const kind = input.transactionType.toLowerCase() as ScheduledTransactionView["ui"]["kind"];
  return {
    id: input.id,
    bookId: BOOK_ID,
    accountId: input.accountId,
    targetAccountId: input.targetAccountId ?? null,
    transactionType: input.transactionType,
    categoryId: "category-1",
    costCenterId: null,
    costCenterName: null,
    contactId: null,
    title: input.title,
    amount: "125.50",
    currencyCode: "TRY",
    scheduledAt: `${input.date}T09:00:00.000Z`,
    reminderAt: null,
    status: input.status,
    seriesId: null,
    recurrenceFrequency: input.status === "PENDING" ? "MONTHLY" : null,
    recurrenceInterval: input.status === "PENDING" ? 1 : null,
    recurrenceEndAt: input.status === "PENDING" ? "2026-12-10T09:00:00.000Z" : null,
    completedTransactionId: input.status === "COMPLETED" ? "transaction-1" : null,
    version: 2,
    ui: {
      kind,
      date: input.date,
      amount: 125.5,
      categoryName: "Fatura",
      costCenterName: "",
    },
  };
}

const pending = scheduledItem({
  accountId: BANK_ID,
  date: "2026-08-10",
  id: "scheduled-pending",
  status: "PENDING",
  title: "Aylık internet",
  transactionType: "EXPENSE",
});
const overdue = scheduledItem({
  accountId: BANK_ID,
  date: "2026-08-11",
  id: "scheduled-overdue",
  status: "OVERDUE",
  targetAccountId: CASH_ID,
  title: "Gecikmiş kira",
  transactionType: "TRANSFER",
});
const completed = scheduledItem({
  accountId: CASH_ID,
  date: "2026-08-12",
  id: "scheduled-completed",
  status: "COMPLETED",
  title: "Ödenen elektrik",
  transactionType: "INCOME",
});
const items = [pending, overdue, completed];

function callbacks() {
  return {
    onDelete: vi.fn(() => Promise.resolve()),
    onEdit: vi.fn(),
    onNew: vi.fn(),
    onRealize: vi.fn(() => Promise.resolve()),
  };
}

function renderPage(
  actions = callbacks(),
  pageItems: readonly ScheduledTransactionView[] = items,
  pageAccounts: readonly AccountView[] = accounts,
) {
  render(
    <MemoryRouter>
      <UpcomingPage accounts={pageAccounts} items={pageItems} {...actions} />
    </MemoryRouter>,
  );
  return actions;
}

function rowFor(title: string): HTMLElement {
  const row = screen.getByText(title).closest<HTMLElement>(".schedule-row");
  if (!row) throw new Error(`${title} satırı bulunamadı.`);
  return row;
}

describe("UpcomingPage", () => {
  it("filters OPEN, COMPLETED and ALL records with their live counts", async () => {
    const user = userEvent.setup();
    renderPage();

    const openFilter = screen.getByRole("button", { name: "Gerçekleşmeyenler 2" });
    const completedFilter = screen.getByRole("button", { name: "Gerçekleşenler 1" });
    const allFilter = screen.getByRole("button", { name: "Tümü 3" });

    expect(openFilter).toHaveClass("active");
    expect(screen.getByText(pending.title)).toBeInTheDocument();
    expect(screen.getByText(overdue.title)).toBeInTheDocument();
    expect(screen.queryByText(completed.title)).not.toBeInTheDocument();

    await user.click(completedFilter);
    expect(completedFilter).toHaveClass("active");
    expect(screen.getByText(completed.title)).toBeInTheDocument();
    expect(screen.queryByText(pending.title)).not.toBeInTheDocument();
    expect(screen.queryByText(overdue.title)).not.toBeInTheDocument();

    await user.click(allFilter);
    expect(allFilter).toHaveClass("active");
    expect(screen.getByText(pending.title)).toBeInTheDocument();
    expect(screen.getByText(overdue.title)).toBeInTheDocument();
    expect(screen.getByText(completed.title)).toBeInTheDocument();
  });

  it("searches only the title with Turkish case rules", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByRole("searchbox", { name: "Açıklamada ara" }), "AYLIK");

    expect(screen.getByText(pending.title)).toBeInTheDocument();
    expect(screen.queryByText(overdue.title)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerçekleşmeyenler 1" })).toBeInTheDocument();

    await user.clear(screen.getByRole("searchbox", { name: "Açıklamada ara" }));
    await user.type(screen.getByRole("searchbox", { name: "Açıklamada ara" }), "Fatura");

    expect(screen.queryByText(pending.title)).not.toBeInTheDocument();
    expect(screen.getByText("Bu filtrelerde kayıt yok.")).toBeInTheDocument();
  });

  it("filters by type and updates status counts from the filtered records", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByRole("combobox", { name: "Tür" }), "TRANSFER");

    expect(screen.queryByText(pending.title)).not.toBeInTheDocument();
    expect(screen.getByText(overdue.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerçekleşmeyenler 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerçekleşenler 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tümü 1" })).toBeInTheDocument();
  });

  it("matches a transfer when either its source or target account is selected", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByText("Hesaplar"));
    await user.click(screen.getByRole("checkbox", { name: "Banka" }));

    expect(screen.queryByText(pending.title)).not.toBeInTheDocument();
    expect(screen.getByText(overdue.title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerçekleşmeyenler 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerçekleşenler 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tümü 2" })).toBeInTheDocument();

    await user.click(screen.getByRole("checkbox", { name: "Nakit" }));
    expect(screen.queryByText(overdue.title)).not.toBeInTheDocument();
    expect(screen.getByText("Bu filtrelerde kayıt yok.")).toBeInTheDocument();
  });

  it("keeps records for removed accounts while every known account is selected", async () => {
    const user = userEvent.setup();
    const removedAccountItem = scheduledItem({
      accountId: "removed-account",
      date: "2026-08-13",
      id: "scheduled-removed-account",
      status: "PENDING",
      title: "Eski hesaptan ödeme",
      transactionType: "EXPENSE",
    });
    renderPage(callbacks(), [...items, removedAccountItem]);

    expect(screen.getByText(removedAccountItem.title)).toBeInTheDocument();

    await user.click(screen.getByText("Hesaplar"));
    await user.click(screen.getByRole("checkbox", { name: "Tüm hesaplar" }));

    expect(screen.queryByText(removedAccountItem.title)).not.toBeInTheDocument();
    expect(screen.getByText("Bu filtrelerde kayıt yok.")).toBeInTheDocument();
  });

  it("includes both date boundaries and combines dates with the status filter", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Tümü 3" }));
    await user.type(screen.getByLabelText("Başlangıç"), "2026-08-10");
    await user.type(screen.getByLabelText("Bitiş"), "2026-08-11");

    expect(screen.getByText(pending.title)).toBeInTheDocument();
    expect(screen.getByText(overdue.title)).toBeInTheDocument();
    expect(screen.queryByText(completed.title)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerçekleşmeyenler 2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerçekleşenler 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tümü 2" })).toHaveClass("active");
  });

  it("shows a range error and deterministically returns no records for reversed dates", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText("Başlangıç"), "2026-08-12");
    await user.type(screen.getByLabelText("Bitiş"), "2026-08-10");

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Başlangıç tarihi bitiş tarihinden sonra olamaz.",
    );
    expect(screen.getByRole("button", { name: "Gerçekleşmeyenler 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Gerçekleşenler 0" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tümü 0" })).toBeInTheDocument();
    expect(screen.getByText("Bu filtrelerde kayıt yok.")).toBeInTheDocument();
  });

  it("clears every secondary filter and restores the default OPEN view", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Gerçekleşenler 1" }));
    await user.type(screen.getByRole("searchbox", { name: "Açıklamada ara" }), "elektrik");
    await user.selectOptions(screen.getByRole("combobox", { name: "Tür" }), "INCOME");
    await user.type(screen.getByLabelText("Başlangıç"), "2026-08-12");
    await user.type(screen.getByLabelText("Bitiş"), "2026-08-12");
    await user.click(screen.getByText("Hesaplar"));
    await user.click(screen.getByRole("checkbox", { name: "Banka" }));
    await user.click(screen.getByRole("button", { name: "Temizle" }));

    expect(screen.getByRole("searchbox", { name: "Açıklamada ara" })).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Tür" })).toHaveValue("");
    expect(screen.getByLabelText("Başlangıç")).toHaveValue("");
    expect(screen.getByLabelText("Bitiş")).toHaveValue("");
    expect(screen.getByRole("checkbox", { name: "Tüm hesaplar" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Gerçekleşmeyenler 2" })).toHaveClass("active");
    expect(screen.getByText(pending.title)).toBeInTheDocument();
    expect(screen.getByText(overdue.title)).toBeInTheDocument();
    expect(screen.queryByText(completed.title)).not.toBeInTheDocument();
  });

  it("calls edit with the selected open record", async () => {
    const user = userEvent.setup();
    const actions = renderPage();

    await user.click(within(rowFor(pending.title)).getByRole("button", { name: "Düzenle" }));

    expect(actions.onEdit).toHaveBeenCalledOnce();
    expect(actions.onEdit).toHaveBeenCalledWith(pending);
  });

  it("realizes an open record only after confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(globalThis, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const actions = renderPage();
    const realize = within(rowFor(pending.title)).getByRole("button", { name: "Gerçekleşti" });

    await user.click(realize);
    expect(confirm).toHaveBeenLastCalledWith(
      `“${pending.title}” gerçekleşti olarak işlemlere aktarılsın mı?`,
    );
    expect(actions.onRealize).not.toHaveBeenCalled();

    await user.click(realize);
    await waitFor(() => expect(actions.onRealize).toHaveBeenCalledWith(pending));
    expect(actions.onRealize).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });

  it("deletes an open record only after confirmation", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(globalThis, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const actions = renderPage();
    const remove = within(rowFor(overdue.title)).getByRole("button", { name: "Sil" });

    await user.click(remove);
    expect(confirm).toHaveBeenLastCalledWith(`“${overdue.title}” planı silinsin mi?`);
    expect(actions.onDelete).not.toHaveBeenCalled();

    await user.click(remove);
    await waitFor(() => expect(actions.onDelete).toHaveBeenCalledWith(overdue));
    expect(actions.onDelete).toHaveBeenCalledOnce();
    confirm.mockRestore();
  });

  it("shows completed records only in matching filters and links them to transactions", async () => {
    const user = userEvent.setup();
    const actions = renderPage();

    expect(screen.queryByText(completed.title)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Gerçekleşenler 1" }));

    const completedRow = rowFor(completed.title);
    expect(completedRow).toHaveClass("completed");
    expect(within(completedRow).getByText("Gerçekleşti")).toBeInTheDocument();
    expect(within(completedRow).getByRole("link", { name: "İşlemi gör" })).toHaveAttribute(
      "href",
      "/transactions",
    );
    expect(within(completedRow).queryByRole("button", { name: "Düzenle" })).not.toBeInTheDocument();
    expect(within(completedRow).queryByRole("button", { name: "Sil" })).not.toBeInTheDocument();
    expect(actions.onEdit).not.toHaveBeenCalled();
    expect(actions.onRealize).not.toHaveBeenCalled();
    expect(actions.onDelete).not.toHaveBeenCalled();
  });
});
