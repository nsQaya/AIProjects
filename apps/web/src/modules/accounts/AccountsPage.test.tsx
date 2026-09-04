import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AccountTypeDTO } from "@defterx/contracts";

import { AccountsPage, type AccountSharingApi, type AccountViewModel } from ".";
import type { SharedAccountView } from "../../finance/finance-views";

const bankType: AccountTypeDTO = {
  id: "type-bank",
  bookId: "book-1",
  name: "Banka",
  icon: null,
  normalBalance: "DEBIT",
  defaultAllowNegativeBalance: false,
  purpose: null,
  isInvestment: false,
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
  isInvestment: false,
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
  currencyCode: "TRY",
  displayBalance: "1250.50",
  displayBalanceTry: "1250.50",
  openingBalance: "0",
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

const sharedOperateAccount: SharedAccountView = {
  id: "shared-1",
  bookId: "book-2",
  contactId: null,
  name: "Ev Bütçesi",
  accountTypeId: "type-bank",
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
  balance: "800",
  displayBalance: "800",
  displayBalanceTry: "800",
  openingBalance: "0",
  availableCredit: null,
  shareId: "share-1",
  permission: "OPERATE",
  ownerBookId: "book-2",
  ownerName: "Eş",
  ownerEmail: "es@example.com",
  ui: { balance: 800, displayBalance: 800, displayBalanceTry: 800, creditLimit: null, availableCredit: null },
};

function sharingApi(accounts: readonly SharedAccountView[]): AccountSharingApi {
  return {
    sharedAccounts: accounts,
    listShares: vi.fn(() => Promise.resolve([])),
    shareAccount: vi.fn(() => Promise.resolve(undefined)),
    updateShare: vi.fn(() => Promise.resolve(undefined)),
    revokeShare: vi.fn(() => Promise.resolve(undefined)),
    loadSharedTransactions: vi.fn(() => Promise.resolve([])),
    loadPostingContext: vi.fn(() =>
      Promise.resolve({
        accountId: "shared-1",
        bookId: "book-2",
        currencyCode: "TRY",
        baseCurrency: "TRY",
        categories: [],
        costCenters: [],
      }),
    ),
    createSharedTransaction: vi.fn(() => Promise.resolve(undefined)),
  };
}

describe("AccountsPage", () => {
  it("keeps opening balance and account type editable after creation", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(<AccountsPage accounts={[bankAccount]} accountTypes={accountTypes} {...actions} />);

    await user.click(screen.getByRole("button", { name: "+ Hesap ekle" }));
    expect(await screen.findByLabelText("Açılış bakiyesi")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    await user.click(screen.getByRole("button", { name: "Düzenle" }));
    const dialog = await screen.findByRole("dialog", { name: "Hesabı düzenle" });
    expect(within(dialog).getByLabelText(/Açılış bakiyesi/)).toHaveValue("0");

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

  it("submits a changed opening balance when editing an account", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    const funded: AccountViewModel = { ...bankAccount, openingBalance: "1000.000000" };
    render(<AccountsPage accounts={[funded]} accountTypes={accountTypes} {...actions} />);

    await user.click(screen.getByRole("button", { name: "Düzenle" }));
    const dialog = await screen.findByRole("dialog", { name: "Hesabı düzenle" });
    const openingBalance = within(dialog).getByLabelText(/Açılış bakiyesi/);
    expect(openingBalance).toHaveValue("1000");

    await user.clear(openingBalance);
    await user.type(openingBalance, "1500,50");
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }));

    expect(actions.onUpdateAccount).toHaveBeenCalledWith(
      funded.id,
      expect.objectContaining({ openingBalance: "1500.50", version: funded.version }),
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
      currencyCode: "TRY",
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
        openingBalance: "0",
        version: bankAccount.version,
      });
    });
  });

  it("shows a foreign-currency account balance in its own currency and in TRY", () => {
    const actions = callbacks();
    const usdAccount: AccountViewModel = {
      ...bankAccount,
      id: "account-usd",
      name: "Piapiri USD",
      currencyCode: "USD",
      displayBalance: "50",
      displayBalanceTry: "1744.68",
    };
    render(<AccountsPage accounts={[usdAccount]} accountTypes={accountTypes} {...actions} />);

    const card = screen.getByText("Piapiri USD").closest(".account-card");
    expect(card).not.toBeNull();
    const balance = card!.querySelector(".account-balance strong");
    expect(balance?.textContent).toContain("50,00");
    expect(balance?.textContent).not.toContain("₺");
    expect(within(card as HTMLElement).getByText("≈ ₺1.744,68")).toBeInTheDocument();
  });

  it("shows shared accounts in their own section and opens the owner share dialog", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    const sharing = sharingApi([sharedOperateAccount]);
    render(
      <AccountsPage
        accounts={[bankAccount]}
        accountTypes={accountTypes}
        sharing={sharing}
        {...actions}
      />,
    );

    expect(screen.getByText("Benimle paylaşılanlar")).toBeInTheDocument();
    const sharedCard = screen.getByText("Ev Bütçesi").closest(".account-card") as HTMLElement;
    expect(within(sharedCard).getByText("İşlem yapabilir")).toBeInTheDocument();
    expect(within(sharedCard).getByRole("button", { name: "İşlem ekle" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Paylaş" }));
    expect(
      await screen.findByRole("dialog", { name: /paylaşımı/ }),
    ).toBeInTheDocument();
    expect(sharing.listShares).toHaveBeenCalledWith(bankAccount.id);
  });

  it("hides the shared section and the Paylaş action when sharing is not wired", () => {
    const actions = callbacks();
    render(<AccountsPage accounts={[bankAccount]} accountTypes={accountTypes} {...actions} />);

    expect(screen.queryByText("Benimle paylaşılanlar")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Paylaş" })).not.toBeInTheDocument();
  });

  it("offers enabled currencies on create and submits the chosen one", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(
      <AccountsPage
        accounts={[bankAccount]}
        accountTypes={accountTypes}
        currencies={[
          { code: "TRY", nameTr: "Türk Lirası", nameEn: "Turkish Lira", isEnabled: true },
          { code: "USD", nameTr: "ABD Doları", nameEn: "US Dollar", isEnabled: true },
          { code: "EUR", nameTr: "Euro", nameEn: "Euro", isEnabled: false },
        ]}
        {...actions}
      />,
    );

    await user.click(screen.getByRole("button", { name: "+ Hesap ekle" }));
    const dialog = await screen.findByRole("dialog", { name: "Hesap ekle" });
    const currency = within(dialog).getByLabelText(/Para birimi/);
    expect(within(currency).queryByRole("option", { name: /Euro/ })).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Hesap adı"), "Piapiri USD");
    await user.selectOptions(currency, "USD");
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(actions.onCreateAccount).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Piapiri USD", currencyCode: "USD" }),
      );
    });
  });
});
