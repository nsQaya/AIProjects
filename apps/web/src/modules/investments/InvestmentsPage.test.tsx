import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { isoAtLocalNoon } from "../../lib/date";
import { InvestmentsPage } from ".";
import type {
  InvestmentAccountOption,
  InvestmentBrokerageAccount,
  InvestmentInstrumentOption,
  InvestmentLotViewModel,
  InvestmentPortfolioViewModel,
  InvestmentSaleViewModel,
} from "./investment-types";

const accounts: readonly InvestmentAccountOption[] = [
  { id: "account-bank", name: "Piapiri TL", isArchived: false },
  { id: "account-old", name: "Eski yatırım hesabı", isArchived: true },
];

const brokerageAccounts: readonly InvestmentBrokerageAccount[] = [
  {
    id: "account-bank",
    name: "Piapiri TL",
    currencyCode: "TRY",
    displayBalance: "5000.00",
    displayBalanceTry: "5000.00",
    isArchived: false,
  },
];

const instruments: readonly InvestmentInstrumentOption[] = [
  { id: "instrument-fund", name: "Teknoloji Fonu", symbol: "TEFAS", isActive: true, marketSymbolId: "market-tefas" },
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
    costBasisTRY: "1250.00",
    currentValueTRY: "1909.375",
    gainTRY: "659.375",
  },
];

const lot: InvestmentLotViewModel = {
  id: "lot-old",
  instrumentId: "instrument-old",
  instrumentName: "Eski Fon",
  symbol: "ESK",
  currencyCode: "TRY",
  accountId: "account-old",
  accountName: "Eski yatırım hesabı",
  quantity: "2.5000",
  unitPrice: "100.25",
  costBasis: "250.625",
  purchasedAt: "2026-01-10T09:00:00.000Z",
  notes: "Eski lot",
  kind: "PURCHASE",
  posted: true,
  version: 4,
};

const fundLot: InvestmentLotViewModel = {
  id: "lot-fund",
  instrumentId: "instrument-fund",
  instrumentName: "Teknoloji Fonu",
  symbol: "TEFAS",
  currencyCode: "TRY",
  accountId: "account-bank",
  accountName: "Piapiri TL",
  quantity: "12.5000",
  unitPrice: "100.00",
  costBasis: "1250.00",
  purchasedAt: "2026-02-01T09:00:00.000Z",
  notes: null,
  kind: "PURCHASE",
  posted: true,
  version: 2,
};

const sale: InvestmentSaleViewModel = {
  id: "sale-old",
  instrumentId: "instrument-old",
  instrumentName: "Eski Fon",
  symbol: "ESK",
  currencyCode: "TRY",
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
    onCreateCapitalIncrease: vi.fn(() => Promise.resolve(undefined)),
    onCreateSale: vi.fn(() => Promise.resolve(undefined)),
    onUpdateSale: vi.fn(() => Promise.resolve(undefined)),
    onDeleteSale: vi.fn(() => Promise.resolve(undefined)),
    onCreateFxConversion: vi.fn(() => Promise.resolve(undefined)),
  };
}

function pageModel(overrides: Partial<{
  lots: readonly InvestmentLotViewModel[];
  sales: readonly InvestmentSaleViewModel[];
}> = {}) {
  return {
    accounts,
    brokerageAccounts,
    fxAccounts: [
      { id: "account-bank", name: "Piapiri TL", currencyCode: "TRY", isArchived: false },
      { id: "account-usd", name: "Piapiri USD", currencyCode: "USD", isArchived: false },
    ],
    instruments,
    lots: overrides.lots ?? [fundLot, lot],
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
      within(dialog).getByLabelText(/Hangi aracı kurum hesabından/),
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

  it("groups a position under its brokerage account with a cash, cost and total summary", () => {
    render(<InvestmentsPage {...pageModel()} {...callbacks()} />);

    const section = document.querySelector<HTMLElement>("[data-account-group='account-bank']")!;
    expect(section).toHaveTextContent("Piapiri TL");
    expect(section).toHaveTextContent(
      "Nakit ₺5.000,00 · Yatırımda ₺1.909,38 · Maliyet ₺1.250,00",
    );
    // 5.000 nakit + 1.909,375 pozisyon değeri
    expect(section).toHaveTextContent("₺6.909,38");
    expect(
      within(section).getByRole("heading", { name: "Teknoloji Fonu" }),
    ).toBeInTheDocument();
  });

  it("keeps each account section collapsed until it is opened", async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage {...pageModel()} {...callbacks()} />);

    const section = document.querySelector<HTMLDetailsElement>("[data-account-group='account-bank']")!;
    expect(section.open).toBe(false);
    // The summary figures stay readable while collapsed.
    expect(section).toHaveTextContent("Nakit ₺5.000,00 · Yatırımda ₺1.909,38 · Maliyet ₺1.250,00");

    await user.click(within(section).getByText("Piapiri TL"));
    expect(section.open).toBe(true);
  });

  it("shows the portfolio value chart above the account sections", () => {
    render(<InvestmentsPage {...pageModel()} {...callbacks()} />);

    const chart = screen.getByRole("heading", { name: "Portföy Değeri Gelişimi" }).closest(".panel")!;
    const firstSection = document.querySelector("[data-account-group]")!;
    expect(chart.compareDocumentPosition(firstSection) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a Bağlanmamış section for a position whose lots name no account", () => {
    const orphan: InvestmentLotViewModel = {
      ...fundLot,
      id: "lot-fund-orphan",
      accountId: null,
      accountName: null,
    };
    render(<InvestmentsPage {...pageModel({ lots: [orphan] })} {...callbacks()} />);

    const section = document.querySelector<HTMLElement>("[data-account-group='unlinked']")!;
    expect(section).toHaveTextContent("Bağlanmamış pozisyonlar");
    expect(section).toHaveTextContent("Bir aracı kurum hesabına bağlı değil");
    expect(
      within(section).getByRole("heading", { name: "Teknoloji Fonu" }),
    ).toBeInTheDocument();
    // The cash-only Piapiri section still renders on its own.
    expect(
      document.querySelector("[data-account-group='account-bank']"),
    ).toHaveTextContent("Bu hesaptan alınmış açık pozisyon yok.");
  });

  it("shows total savings as brokerage cash plus open positions in the header", () => {
    render(<InvestmentsPage {...pageModel()} {...callbacks()} />);

    const intro = screen.getByText("Toplam birikim varlığı").closest(".section-intro")!;
    expect(intro).toHaveTextContent("₺6.909,38");
    expect(intro).toHaveTextContent("Nakit ₺5.000,00 · Pozisyon ₺1.909,38");
  });

  it("opens the döviz al dialog from the investments header", async () => {
    const user = userEvent.setup();
    render(<InvestmentsPage {...pageModel()} {...callbacks()} />);

    await user.click(screen.getByRole("button", { name: "+ Döviz al" }));
    const dialog = await screen.findByRole("dialog", { name: "Döviz al" });
    expect(within(dialog).getByLabelText("Döviz hesabı")).toBeInTheDocument();
  });

  it("shows the brokerage account per lot and flags an unposted one", () => {
    const actions = callbacks();
    const linked: InvestmentLotViewModel = { ...lot, id: "lot-linked", accountName: "Piapiri TL", posted: true };
    const unlinked: InvestmentLotViewModel = { ...lot, id: "lot-unlinked", accountName: "Piapiri TL", posted: false };
    const noAccount: InvestmentLotViewModel = { ...lot, id: "lot-none", accountId: null, accountName: null, posted: false };
    render(<InvestmentsPage {...pageModel({ lots: [linked, unlinked, noAccount] })} {...actions} />);

    const linkedRow = document.querySelector("[data-lot-id='lot-linked']")!;
    expect(linkedRow).toHaveTextContent("Piapiri TL");
    expect(linkedRow).not.toHaveTextContent("nakit bağlı değil");
    expect(document.querySelector("[data-lot-id='lot-unlinked']")).toHaveTextContent("nakit bağlı değil");
    expect(document.querySelector("[data-lot-id='lot-none']")).toHaveTextContent("—");
  });

  it("records a bonus issue as a bedelsiz capital increase and warns on a linked instrument", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(<InvestmentsPage {...pageModel()} {...actions} />);

    await user.click(screen.getByRole("button", { name: "+ Sermaye artırımı" }));
    const dialog = await screen.findByRole("dialog", { name: "Sermaye artırımı / bölünme" });
    await user.selectOptions(within(dialog).getByLabelText(/Yatırım aracı/), "instrument-fund");
    expect(within(dialog).getByText(/oran bölünmeleri otomatik/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Yeni toplam adet/), "25");
    const date = within(dialog).getByLabelText("Tarih");
    await user.clear(date);
    await user.type(date, "2026-08-10");
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(actions.onCreateCapitalIncrease).toHaveBeenCalledWith({
        instrumentId: "instrument-fund",
        newTotalQuantity: "25",
        amountPaid: "0",
        accountId: null,
        effectiveAt: isoAtLocalNoon("2026-08-10"),
        notes: null,
      });
    });
  });

  it("requires an account for a paid (bedelli) capital increase", async () => {
    const user = userEvent.setup();
    const actions = callbacks();
    render(<InvestmentsPage {...pageModel()} {...actions} />);

    await user.click(screen.getByRole("button", { name: "+ Sermaye artırımı" }));
    const dialog = await screen.findByRole("dialog", { name: "Sermaye artırımı / bölünme" });
    await user.selectOptions(within(dialog).getByLabelText(/Yatırım aracı/), "instrument-fund");
    await user.type(within(dialog).getByLabelText(/Yeni toplam adet/), "25");
    const paid = within(dialog).getByLabelText(/Bu artırım için ödenen tutar/);
    await user.clear(paid);
    await user.type(paid, "500");
    await user.click(within(dialog).getByRole("button", { name: "Kaydet" }));

    expect(within(dialog).getByText(/ödemenin çıktığı hesabı seçin/)).toBeInTheDocument();
    expect(actions.onCreateCapitalIncrease).not.toHaveBeenCalled();
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
    expect(within(dialog).getByLabelText(/Hangi aracı kurum hesabından/)).toHaveValue(
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
