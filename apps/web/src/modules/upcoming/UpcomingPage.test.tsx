import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

import type { ScheduledTransactionView } from "../../finance/finance-views";
import { UpcomingPage } from "./UpcomingPage";

function scheduledItem(
  id: string,
  title: string,
  status: ScheduledTransactionView["status"],
): ScheduledTransactionView {
  return {
    id,
    bookId: "book-1",
    accountId: "account-1",
    targetAccountId: null,
    transactionType: "EXPENSE",
    categoryId: "category-1",
    costCenterId: null,
    costCenterName: null,
    contactId: null,
    title,
    amount: "125.50",
    currencyCode: "TRY",
    scheduledAt: "2026-08-10T09:00:00.000Z",
    reminderAt: null,
    status,
    seriesId: null,
    recurrenceFrequency: status === "PENDING" ? "MONTHLY" : null,
    recurrenceInterval: status === "PENDING" ? 1 : null,
    recurrenceEndAt: status === "PENDING" ? "2026-12-10T09:00:00.000Z" : null,
    completedTransactionId: status === "COMPLETED" ? "transaction-1" : null,
    version: 2,
    ui: {
      kind: "expense",
      date: "2026-08-10",
      amount: 125.5,
      categoryName: "Fatura",
      costCenterName: "",
    },
  };
}

const pending = scheduledItem("scheduled-pending", "Aylık internet", "PENDING");
const overdue = scheduledItem("scheduled-overdue", "Gecikmiş kira", "OVERDUE");
const completed = scheduledItem("scheduled-completed", "Ödenen elektrik", "COMPLETED");
const items = [pending, overdue, completed];

function callbacks() {
  return {
    onDelete: vi.fn(() => Promise.resolve()),
    onEdit: vi.fn(),
    onNew: vi.fn(),
    onRealize: vi.fn(() => Promise.resolve()),
  };
}

function renderPage(actions = callbacks()) {
  render(
    <MemoryRouter>
      <UpcomingPage items={items} {...actions} />
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
