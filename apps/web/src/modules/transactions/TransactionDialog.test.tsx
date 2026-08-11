import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CostCenterDTO } from "@defterx/contracts";
import type { AccountView } from "../../finance/finance-views";
import { TransactionDialog } from "./TransactionDialog";

const account = {
  id: "account-1",
  bookId: "book-1",
  contactId: null,
  name: "Banka",
  accountType: "BANK",
  normalBalance: "DEBIT",
  currencyCode: "TRY",
  allowNegativeBalance: false,
  creditLimit: null,
  isArchived: false,
  sortOrder: 0,
  version: 1,
  balance: "0",
  displayBalance: "0",
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
        categories={[]}
        costCenters={[costCenter]}
        onClose={vi.fn()}
        onSave={onSave}
        open
        transaction={null}
      />,
    );

    await user.type(screen.getByLabelText(/Tutar/), "125,50");
    await user.type(screen.getByLabelText("Açıklama"), "Araç yakıtı");
    await user.selectOptions(screen.getByLabelText("Masraf merkezi"), costCenter.id);
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "EXPENSE",
          title: "Araç yakıtı",
          amount: "125.5",
          accountId: account.id,
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
});
