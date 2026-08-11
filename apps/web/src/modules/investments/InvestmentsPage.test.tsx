import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { isoAtLocalNoon } from "../../lib/date";
import { InvestmentsPage } from ".";
import type {
  InvestmentAccountOption,
  InvestmentInstrumentOption,
  InvestmentLotViewModel,
  InvestmentPortfolioViewModel,
  InvestmentSaleViewModel,
} from "./investment-types";

const accounts: readonly InvestmentAccountOption[] = [
  { id: "account-bank", name: "Ana banka", isArchived: false },
  { id: "account-old", name: "Eski yatırım hesabı", isArchived: true },
];

const instruments: readonly InvestmentInstrumentOption[] = [
  { id: "instrument-fund", name: "Teknoloji Fonu", symbol: "TEFAS", isActive: true },
  { id: "instrument-old", name: "Eski Fon", symbol: "ESK", isActive: false },
];

const portfolio: readonly InvestmentPortfolioViewModel[] = [
  {
    instrumentId: "instrument-fund",
    name: "Teknoloji Fonu",
    symbol: "TEFAS",
    assetTypeName: "Fon",
    currencyCode: "TRY",
    quantity: "12.5000",
    costBasis: "1250.00",
    realizedGain: "0",
    latestPrice: "152.75",
    latestPriceAt: "2026-08-06T12:00:00.000Z",
    currentValue: "1909.375",
    gain: "659.375",
    gainPercent: "52.75",
  },
];

const lot: InvestmentLotViewModel = {
  id: "lot-old",
  instrumentId: "instrument-old",
  instrumentName: "Eski Fon",
  symbol: "ESK",
  accountId: "account-old",
  accountName: "Eski yatırım hesabı",
  quantity: "2.5000",
  unitPrice: "100.25",
  costBasis: "250.625",
  purchasedAt: "2026-01-10T09:00:00.000Z",
  notes: "Eski lot",
  version: 4,
};

const sale: InvestmentSaleViewModel = {
  id: "sale-old",
  instrumentId: "instrument-old",
  instrumentName: "Eski Fon",
  symbol: "ESK",
  destinationAccountId: "account-old",
  destinationAccountName: "Eski yatırım hesabı",
  quantity: "1.2500",
  unitPrice: "120.40",
  proceeds: "150.50",
  costBasis: "125.00",
  gain: "25.50",
  soldAt: "2026-03-10T09:00:00.000Z",
  notes: "Kısmi satış",
  version: 7,
};

function callbacks() {
  return {
    onCreateLot: vi.fn(() => Promise.resolve(undefined)),
    onUpdateLot: vi.fn(() => Promise.resolve(undefined)),
    onDeleteLot: vi.fn(() => Promise.resolve(undefined)),
    onCreateSale: vi.fn(() => Promise.resolve(undefined)),
    onUpdateSale: vi.fn(() => Promise.resolve(undefined)),
    onDeleteSale: vi.fn(() => Promise.resolve(undefined)),
  };
}

function pageModel(overrides: Partial<{
  lots: readonly InvestmentLotViewModel[];
  sales: readonly InvestmentSaleViewModel[];
}> = {}) {
  return {
    accounts,
    instruments,
    lots: overrides.lots ?? [lot],
    portfolio,
    sales: overrides.sales ?? [sale],
  };
}

describe("InvestmentsPage", () => {
  it("creates a purchase lot with exact decimal strings and a local-noon date", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(<InvestmentsPage {...pageModel()} {...actions} />);

    await user.click(screen.getByRole("button", { name: "+ Birikim alımı" }));
    const dialog = await screen.findByRole("dialog", { name: "Birikim alımı" });
    await user.selectOptions(within(dialog).getByLabelText("Yatırım aracı"), "instrument-fund");
    await user.type(within(dialog).getByLabelText("Adet"), "10,5000");
    await user.type(within(dialog).getByLabelText("Alış fiyatı"), "1.234,56");
    await user.selectOptions(
      within(dialog).getByLabelText("İlişkili hesap (isteğe bağlı)"),
      "account-bank",
    );
    const date = within(dialog).getByLabelText("Alış tarihi");
    await user.clear(date);
    await user.type(date, "2026-08-07");
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(actions.onCreateLot).toHaveBeenCalledWith({
        instrumentId: "instrument-fund",
        accountId: "account-bank",
        quantity: "10.5000",
        unitPrice: "1234.56",
        purchasedAt: isoAtLocalNoon("2026-08-07"),
        notes: null,
      });
    });
    expect(screen.queryByRole("dialog", { name: "Birikim alımı" })).not.toBeInTheDocument();
  });

  it("shows the server-provided latest price and valuation on the portfolio card", () => {
    const actions = callbacks();
    render(<InvestmentsPage {...pageModel()} {...actions} />);

    expect(screen.getByRole("heading", { name: "Teknoloji Fonu" })).toBeInTheDocument();
    expect(screen.getByText(/Son fiyat/)).toHaveTextContent("Son fiyat ₺152,75");
    expect(screen.getByText(/Son fiyat/)).toHaveTextContent("6 Ağustos 2026");
    expect(screen.getByText(/12\.5000 adet/)).toBeInTheDocument();
  });

  it("records the selected destination account when creating a sale", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(<InvestmentsPage {...pageModel()} {...actions} />);

    await user.click(screen.getByRole("button", { name: "Birikim sat" }));
    const dialog = await screen.findByRole("dialog", { name: "Birikim satışı" });
    await user.selectOptions(
      within(dialog).getByLabelText("Satılacak yatırım aracı"),
      "instrument-fund",
    );
    await user.type(within(dialog).getByLabelText("Satılacak adet"), "2,2500");
    await user.type(within(dialog).getByLabelText("Birim satış fiyatı"), "175,40");
    await user.selectOptions(
      within(dialog).getByLabelText("Para hangi hesaba geçti?"),
      "account-bank",
    );
    const date = within(dialog).getByLabelText("Satış tarihi");
    await user.clear(date);
    await user.type(date, "2026-08-07");
    await user.click(within(dialog).getByRole("button", { name: "Satışı kaydet" }));

    await waitFor(() => {
      expect(actions.onCreateSale).toHaveBeenCalledWith({
        instrumentId: "instrument-fund",
        destinationAccountId: "account-bank",
        quantity: "2.2500",
        unitPrice: "175.40",
        soldAt: isoAtLocalNoon("2026-08-07"),
        notes: null,
      });
    });
  });

  it("retains inactive and archived selections while editing a sale, then offers server reversal on delete", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    const confirmDeleteSale = vi.fn(() => true);
    const { container } = render(
      <InvestmentsPage
        {...pageModel()}
        {...actions}
        confirmDeleteSale={confirmDeleteSale}
      />,
    );

    const editButton = container.querySelector<HTMLButtonElement>("[data-edit-sale='sale-old']");
    expect(editButton).not.toBeNull();
    await user.click(editButton!);
    const dialog = await screen.findByRole("dialog", { name: "Satışı düzenle" });
    expect(within(dialog).getByLabelText("Satılacak yatırım aracı")).toHaveValue("instrument-old");
    expect(within(dialog).getByRole("option", { name: /Eski Fon.*Pasif/ })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Para hangi hesaba geçti?")).toHaveValue("account-old");
    expect(
      within(dialog).getByRole("option", { name: /Eski yatırım hesabı.*Arşivli/ }),
    ).toBeInTheDocument();
    const quantity = within(dialog).getByLabelText("Satılacak adet");
    await user.clear(quantity);
    await user.type(quantity, "1,1250");
    await user.click(within(dialog).getByRole("button", { name: "Değişiklikleri kaydet" }));

    await waitFor(() => {
      expect(actions.onUpdateSale).toHaveBeenCalledWith(
        "sale-old",
        expect.objectContaining({
          instrumentId: "instrument-old",
          destinationAccountId: "account-old",
          quantity: "1.1250",
          version: 7,
        }),
      );
    });

    const deleteButton = container.querySelector<HTMLButtonElement>("[data-delete-sale='sale-old']");
    expect(deleteButton).not.toBeNull();
    await user.click(deleteButton!);
    await waitFor(() => expect(actions.onDeleteSale).toHaveBeenCalledWith("sale-old", 7));
    expect(confirmDeleteSale).toHaveBeenCalledWith(
      sale,
      expect.stringContaining("sunucuda ters kayıtla geri alınacaktır"),
    );
  });

  it("edits and deletes a purchase lot without dropping selected inactive records", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    const confirmDeleteLot = vi.fn(() => true);
    const { container } = render(
      <InvestmentsPage
        {...pageModel()}
        {...actions}
        confirmDeleteLot={confirmDeleteLot}
      />,
    );

    const editButton = container.querySelector<HTMLButtonElement>("[data-edit-lot='lot-old']");
    expect(editButton).not.toBeNull();
    await user.click(editButton!);
    const dialog = await screen.findByRole("dialog", { name: "Alımı düzenle" });
    expect(within(dialog).getByLabelText("Yatırım aracı")).toHaveValue("instrument-old");
    expect(within(dialog).getByLabelText("İlişkili hesap (isteğe bağlı)")).toHaveValue(
      "account-old",
    );
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }));
    await waitFor(() => {
      expect(actions.onUpdateLot).toHaveBeenCalledWith(
        "lot-old",
        expect.objectContaining({ version: 4, quantity: "2.5000", unitPrice: "100.25" }),
      );
    });

    const deleteButton = container.querySelector<HTMLButtonElement>("[data-delete-lot='lot-old']");
    expect(deleteButton).not.toBeNull();
    await user.click(deleteButton!);
    await waitFor(() => expect(actions.onDeleteLot).toHaveBeenCalledWith("lot-old", 4));
  });

  it.each([
    ["purchase", "+ Birikim alımı", "Birikim alımı", "Vazgeç"],
    ["sale", "Birikim sat", "Birikim satışı", "Satış penceresini kapat"],
  ])("closes a blank %s dialog without running validation or a mutation", async (
    _kind,
    openButton,
    dialogName,
    closeButton,
  ) => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(<InvestmentsPage {...pageModel({ lots: [], sales: [] })} {...actions} />);

    await user.click(screen.getByRole("button", { name: openButton }));
    const dialog = await screen.findByRole("dialog", { name: dialogName });
    await user.click(within(dialog).getByRole("button", { name: closeButton }));

    expect(screen.queryByRole("dialog", { name: dialogName })).not.toBeInTheDocument();
    expect(actions.onCreateLot).not.toHaveBeenCalled();
    expect(actions.onCreateSale).not.toHaveBeenCalled();
  });

  it("keeps a failed sale mutation open and renders the API error inside the dialog", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    actions.onUpdateSale.mockRejectedValueOnce(new Error("Satış adedi eldeki miktarı aşıyor."));
    const { container } = render(<InvestmentsPage {...pageModel()} {...actions} />);

    await user.click(container.querySelector<HTMLButtonElement>("[data-edit-sale='sale-old']")!);
    const dialog = await screen.findByRole("dialog", { name: "Satışı düzenle" });
    await user.click(within(dialog).getByRole("button", { name: "Değişiklikleri kaydet" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Satış adedi eldeki miktarı aşıyor.",
    );
    expect(dialog).toBeInTheDocument();
  });
});
