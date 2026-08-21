import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountTypeDTO } from "@defterx/contracts";

import { AccountsPage, type AccountViewModel } from ".";

const bankType: AccountTypeDTO = {
  id: "type-bank",
  bookId: "book-1",
  name: "Banka",
  icon: null,
  normalBalance: "DEBIT",
  defaultAllowNegativeBalance: false,
  purpose: null,
  isSystem: true,
  isActive: true,
  sortOrder: 20,
  version: 1,
};

const creditCardType: AccountTypeDTO = {
  id: "type-credit-card",
  bookId: "book-1",
  name: "Kredi Kartı",
  icon: null,
  normalBalance: "CREDIT",
  defaultAllowNegativeBalance: true,
  purpose: null,
  isSystem: true,
  isActive: true,
  sortOrder: 30,
  version: 1,
};

const accountTypes: readonly AccountTypeDTO[] = [bankType, creditCardType];

const bankAccount: AccountViewModel = {
  id: "account-1",
  name: "Maaş hesabı",
  accountTypeId: bankType.id,
  accountTypeName: bankType.name,
  accountTypeIcon: null,
  displayBalance: "1250.50",
  allowNegativeBalance: false,
  creditLimit: null,
  availableCredit: null,
  isArchived: false,
  version: 3,
};

function callbacks() {
  return {
    onCreateAccount: vi.fn(() => Promise.resolve(undefined)),
    onDeleteAccount: vi.fn(() => Promise.resolve(undefined)),
    onUpdateAccount: vi.fn(() => Promise.resolve(undefined)),
  };
}

describe("AccountsPage", () => {
  it("shows opening balance only on create and keeps account type editable", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(<AccountsPage accounts={[bankAccount]} accountTypes={accountTypes} {...actions} />);

    await user.click(screen.getByRole("button", { name: "+ Hesap ekle" }));
    expect(await screen.findByLabelText("Açılış bakiyesi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    await user.click(screen.getByRole("button", { name: "Düzenle" }));
    const dialog = await screen.findByRole("dialog", { name: "Hesabı düzenle" });
    expect(within(dialog).queryByLabelText("Açılış bakiyesi")).not.toBeInTheDocument();

    const type = within(dialog).getByLabelText("Hesap türü");
    expect(type).toBeEnabled();
    await user.selectOptions(type, creditCardType.id);
    expect(type).toHaveValue(creditCardType.id);
    expect(within(dialog).getByLabelText("Eksi bakiyeye izin ver")).toBeChecked();

    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }));
    expect(actions.onUpdateAccount).toHaveBeenCalledWith(
      bankAccount.id,
      expect.objectContaining({ accountTypeId: creditCardType.id, version: bankAccount.version }),
    );
  });

  it("reveals and submits an optional overdraft limit only when negative balance is allowed", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(<AccountsPage accounts={[]} accountTypes={accountTypes} {...actions} />);

    await user.click(screen.getByRole("button", { name: "+ Hesap ekle" }));
    const dialog = await screen.findByRole("dialog", { name: "Hesap ekle" });
    const allowNegative = within(dialog).getByLabelText("Eksi bakiyeye izin ver");
    const limit = within(dialog).getByLabelText("Eksi bakiye / kredi limiti");

    expect(limit).not.toBeVisible();
    await user.click(allowNegative);
    expect(limit).toBeVisible();

    await user.type(within(dialog).getByLabelText("Hesap adı"), "KMH hesabı");
    await user.type(limit, "15.000,50");
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }));

    expect(actions.onCreateAccount).toHaveBeenCalledWith({
      name: "KMH hesabı",
      accountTypeId: bankType.id,
      allowNegativeBalance: true,
      creditLimit: "15000.50",
      openingBalance: "0",
    });
  });

  it.each([
    ["Vazgeç"],
    ["Hesap penceresini kapat"],
  ])("closes a blank required form with %s without submitting it", async (buttonName) => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(<AccountsPage accounts={[]} accountTypes={accountTypes} {...actions} />);

    await user.click(screen.getByRole("button", { name: "+ Hesap ekle" }));
    const dialog = await screen.findByRole("dialog", { name: "Hesap ekle" });
    await user.click(within(dialog).getByRole("button", { name: buttonName }));

    expect(screen.queryByRole("dialog", { name: "Hesap ekle" })).not.toBeInTheDocument();
    expect(actions.onCreateAccount).not.toHaveBeenCalled();
  });

  it("keeps the dialog open and shows mutation errors inside it", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    actions.onUpdateAccount.mockRejectedValueOnce(
      new Error("Bakiyesi olan hesabın türü veya limiti değiştirilemedi."),
    );
    render(<AccountsPage accounts={[bankAccount]} accountTypes={accountTypes} {...actions} />);

    await user.click(screen.getByRole("button", { name: "Düzenle" }));
    const dialog = await screen.findByRole("dialog", { name: "Hesabı düzenle" });
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }));

    expect(within(dialog).getByRole("alert")).toHaveTextContent(
      "Bakiyesi olan hesabın türü veya limiti değiştirilemedi.",
    );
    expect(dialog).toBeInTheDocument();
  });

  it("submits values assigned by the Edge smoke flow before requestSubmit", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(<AccountsPage accounts={[bankAccount]} accountTypes={accountTypes} {...actions} />);

    await user.click(screen.getByRole("button", { name: "Düzenle" }));
    const form = document.querySelector<HTMLFormElement>("#account-form");
    expect(form).not.toBeNull();
    if (!form) return;

    const name = form.elements.namedItem("name") as HTMLInputElement;
    const allowNegative = form.elements.namedItem("allowNegativeBalance") as HTMLInputElement;
    name.value = "Canlı Banka Düzenlendi";
    await user.click(allowNegative);

    const creditLimit = form.elements.namedItem("creditLimit") as HTMLInputElement;
    expect(creditLimit).toBeEnabled();
    creditLimit.value = "500";
    act(() => form.requestSubmit());

    await waitFor(() => {
      expect(actions.onUpdateAccount).toHaveBeenCalledWith(bankAccount.id, {
        name: "Canlı Banka Düzenlendi",
        accountTypeId: bankType.id,
        allowNegativeBalance: true,
        creditLimit: "500",
        version: bankAccount.version,
      });
    });
  });
});
