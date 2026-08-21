import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CategoryDTO, CostCenterDTO } from "@defterx/contracts";
import type { AccountView } from "../../finance/finance-views";
import { ScheduledDialog } from "./ScheduledDialog";

const accounts = ["Banka", "Nakit"].map((name, index) => ({
  id: `account-${index}`,
  bookId: "book-1",
  contactId: null,
  name,
  accountTypeId: "type-bank",
  accountTypeName: "Banka",
  accountTypeIcon: null,
  normalBalance: "DEBIT" as const,
  currencyCode: "TRY",
  allowNegativeBalance: false,
  creditLimit: null,
  isArchived: false,
  sortOrder: index,
  version: 1,
  balance: "0",
  displayBalance: "0",
  availableCredit: null,
  ui: { balance: 0, displayBalance: 0, creditLimit: null, availableCredit: null },
})) satisfies AccountView[];

const category = {
  id: "category-1",
  bookId: "book-1",
  parentId: null,
  name: "Yakıt",
  categoryType: "EXPENSE",
  icon: null,
  sortOrder: 10,
  isSystem: false,
  isActive: true,
  version: 1,
} satisfies CategoryDTO;

const costCenter = {
  id: "cost-center-1",
  bookId: "book-1",
  name: "Aile arabası",
  description: null,
  sortOrder: 10,
  isActive: true,
  version: 1,
} satisfies CostCenterDTO;

describe("ScheduledDialog", () => {
  it("transferde hedef hesabı, tekrarda bitiş tarihini gösterir", async () => {
    const user = userEvent.setup();
    render(<ScheduledDialog accounts={accounts} categories={[category]} costCenters={[costCenter]} item={null} onClose={vi.fn()} onSave={vi.fn()} open />);
    await user.selectOptions(screen.getByLabelText("Tür"), "transfer");
    expect(screen.getByLabelText("Hedef hesap")).toBeInTheDocument();
    expect(screen.getByLabelText("Kategori")).toBeDisabled();
    expect(screen.getByLabelText("Kategori").closest("label")).toHaveAttribute("hidden");
    expect(screen.getByLabelText("Masraf merkezi")).toBeDisabled();
    expect(screen.getByLabelText("Masraf merkezi").closest("label")).toHaveAttribute("hidden");
    await user.selectOptions(screen.getByLabelText("Tekrar"), "MONTHLY");
    expect(screen.getByLabelText("Şu tarihe kadar")).toBeInTheDocument();
  });

  it("planlanan giderde masraf merkezi seçimini kaydeder", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <ScheduledDialog
        accounts={accounts}
        categories={[category]}
        costCenters={[costCenter]}
        item={null}
        onClose={vi.fn()}
        onSave={onSave}
        open
      />,
    );

    await user.type(screen.getByLabelText("Başlık"), "Aylık yakıt");
    await user.type(screen.getByLabelText("Tutar"), "99,90");
    await user.selectOptions(screen.getByLabelText("Kategori"), category.id);
    await user.selectOptions(screen.getByLabelText("Masraf merkezi"), costCenter.id);
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          transactionType: "EXPENSE",
          title: "Aylık yakıt",
          amount: "99.9",
          accountId: accounts[0]!.id,
          categoryId: category.id,
          costCenterId: costCenter.id,
          targetAccountId: null,
        }),
        null,
      );
    });
  });
});
