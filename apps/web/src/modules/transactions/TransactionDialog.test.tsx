import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CategoryDTO, CostCenterDTO } from "@defterx/contracts";
import type { AccountView, TransactionView } from "../../finance/finance-views";
import { TransactionDialog } from "./TransactionDialog";

const account = {
  id: "account-1",
  bookId: "book-1",
  contactId: null,
  name: "Banka",
  accountTypeId: "00000000-0000-4000-8000-000000000091",
  accountTypeName: "Banka",
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
  ui: { balance: 0, displayBalance: 0, creditLimit: null, availableCredit: null },
} satisfies AccountView;

const costCenter = {
  id: "cost-center-1",
  bookId: "book-1",
  name: "Aile arabası",
  description: "Yakıt ve bakım",
  sortOrder: 10,
  isActive: true,
  version: 1,
} satisfies CostCenterDTO;

const category = {
  id: "category-1",
  bookId: "book-1",
  parentId: null,
  name: "Ulaşım",
  categoryType: "EXPENSE",
  icon: null,
  sortOrder: 10,
  isSystem: false,
  isActive: true,
  version: 1,
} satisfies CategoryDTO;

const transaction = {
  id: "transaction-1",
  transactionNo: "1",
  type: "EXPENSE",
  accountId: account.id,
  accountName: account.name,
  targetAccountId: null,
  targetAccountName: null,
  title: "Yakıt",
  description: null,
  transactionDate: "2026-08-14T12:00:00.000Z",
  dueDate: null,
  status: "POSTED",
  currencyCode: "TRY",
  categoryId: category.id,
  categoryName: category.name,
  costCenterId: null,
  costCenterName: null,
  contactId: null,
  version: 1,
  amount: "1452.850000",
  balanceDelta: "-1452.850000",
  runningBalance: "0",
  ui: {
    kind: "expense",
    description: "Yakıt",
    date: "2026-08-14",
    amount: 1452.85,
    balanceDelta: -1452.85,
    runningBalance: 0,
  },
} satisfies TransactionView;

describe("TransactionDialog", () => {
  it("hedef hesabı yalnız transfer türünde gösterir", async () => {
    const user = userEvent.setup();
    render(
      <TransactionDialog
        accounts={[account]}
        categories={[]}
        costCenters={[costCenter]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open
        transaction={null}
      />,
    );

    expect(screen.getByLabelText("Hedef hesap")).toBeDisabled();
    expect(screen.getByLabelText("Hedef hesap").closest("label")).toHaveAttribute("hidden");
    expect(screen.getByLabelText("Masraf merkezi")).toBeEnabled();
    await user.click(screen.getByText("Gelir"));
    expect(screen.getByLabelText("Masraf merkezi")).toBeDisabled();
    expect(screen.getByLabelText("Masraf merkezi").closest("label")).toHaveAttribute("hidden");
    await user.click(screen.getByText("Transfer"));
    expect(screen.getByLabelText("Hedef hesap")).toBeInTheDocument();
    expect(screen.getByLabelText("Kategori")).toBeDisabled();
    expect(screen.getByLabelText("Kategori").closest("label")).toHaveAttribute("hidden");
    expect(screen.getByLabelText("Masraf merkezi")).toBeDisabled();
  });

  it("gider işlemine seçilen masraf merkezini kaydeder", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionDialog
        accounts={[account]}
        categories={[category]}
        costCenters={[costCenter]}
        onClose={vi.fn()}
        onSave={onSave}
        open
        transaction={null}
      />,
    );

    await user.type(screen.getByLabelText(/Tutar/), "125,50");
    await user.type(screen.getByLabelText("Açıklama"), "Araç yakıtı");
    await user.selectOptions(screen.getByLabelText("Kategori"), category.id);
    await user.selectOptions(screen.getByLabelText("Masraf merkezi"), costCenter.id);
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EXPENSE",
          title: "Araç yakıtı",
          amount: "125.5",
          accountId: account.id,
          categoryId: category.id,
          costCenterId: costCenter.id,
        }),
        null,
      );
    });
  });

  it("boş formdayken Vazgeç ile doğrulama göstermeden kapanır", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <TransactionDialog accounts={[account]} categories={[]} costCenters={[]} onClose={onClose} onSave={vi.fn()} open transaction={null} />,
    );
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("tutar alanında harfleri reddeder ve noktayı virgüle çevirir", async () => {
    const user = userEvent.setup();

    render(
      <TransactionDialog
        accounts={[account]}
        categories={[]}
        costCenters={[]}
        onClose={vi.fn()}
        onSave={vi.fn()}
        open
        transaction={null}
      />,
    );

    const amountInput = screen.getByLabelText(/Tutar/);
    await user.type(amountInput, "23423werwefdwe.8500007");

    expect(amountInput).toHaveValue("23423,850000");
  });

  it("düzeltmede API tutarını virgülle gösterir ve doğru kaydeder", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionDialog
        accounts={[account]}
        categories={[category]}
        costCenters={[]}
        onClose={vi.fn()}
        onSave={onSave}
        open
        transaction={transaction}
      />,
    );

    expect(screen.getByLabelText(/Tutar/)).toHaveValue("1452,850000");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({ amount: "1452.85" }),
        transaction,
      );
    });
  });

  it("seeds the form from a prefill and shows the overridden title", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <TransactionDialog
        accounts={[account]}
        categories={[category]}
        costCenters={[costCenter]}
        onClose={vi.fn()}
        onSave={onSave}
        open
        transaction={null}
        title="Planı gerçekleştir"
        prefill={{
          type: "EXPENSE",
          title: "Aylık kira",
          amount: "3500.000000",
          accountId: account.id,
          categoryId: category.id,
          transactionDate: "2026-09-01T09:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Planı gerçekleştir" })).toBeInTheDocument();
    expect(screen.getByLabelText("Açıklama")).toHaveValue("Aylık kira");
    expect(screen.getByLabelText(/Tutar/)).toHaveValue("3500,000000");
    expect(screen.getByLabelText("Tarih")).toHaveValue("2026-09-01");
    expect(screen.getByLabelText("Kategori")).toHaveValue(category.id);

    await user.clear(screen.getByLabelText(/Tutar/));
    await user.type(screen.getByLabelText(/Tutar/), "3650,50");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EXPENSE",
          title: "Aylık kira",
          amount: "3650.5",
          accountId: account.id,
          categoryId: category.id,
        }),
        null,
      );
    });
  });
});
