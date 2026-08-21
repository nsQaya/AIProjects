import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type {
  AccountTypeDTO,CategoryDTO,CostCenterDTO,CurrencyDTO,InvestmentAssetTypeDTO,InvestmentInstrumentDTO,MarketPriceSyncRunDTO,
} from "@defterx/contracts";
import { describe, expect, it, vi } from "vitest";

import { SettingsPage } from "./SettingsPage";
import type { SettingsActions, SettingsViewModel } from "./settings-types";

const category: CategoryDTO = {
  id: "category-1",
  bookId: "book-1",
  parentId: null,
  name: "Market",
  categoryType: "EXPENSE",
  icon: null,
  sortOrder: 10,
  isSystem: false,
  isActive: true,
  version: 3,
};

const activeCostCenter: CostCenterDTO = {
  id: "cost-center-1",
  bookId: "book-1",
  name: "Aile arabası",
  description: "Yakıt ve bakım",
  sortOrder: 10,
  isActive: true,
  version: 3,
};

const inactiveCostCenter: CostCenterDTO = {
  ...activeCostCenter,
  id: "cost-center-2",
  name: "Eski araç",
  description: null,
  isActive: false,
  version: 5,
};

const accountType:AccountTypeDTO={
  id:"account-type-1",bookId:"book-1",name:"Banka",icon:null,normalBalance:"DEBIT",
  defaultAllowNegativeBalance:false,purpose:null,isSystem:true,isActive:true,sortOrder:1,version:1,
};

const investmentType:InvestmentAssetTypeDTO={
  id:"type-1",bookId:"book-1",name:"Hisse",icon:null,isSystem:true,isActive:true,sortOrder:1,version:1,
};

const linkedInstrument:InvestmentInstrumentDTO={
  id:"instrument-1",bookId:"book-1",assetTypeId:"type-1",assetTypeName:"Hisse",name:"Apple Inc.",
  symbol:"AAPL",marketSymbolId:"market-aapl",providerSymbol:"AAPL",currencyCode:"USD",isActive:true,
  version:1,latestPrice:null,latestPriceAt:null,
};

const completedRun:MarketPriceSyncRunDTO={
  id:"run-1",kind:"PRICES",targetDate:"2026-08-14",status:"COMPLETED",totalItems:2,processedItems:2,
  updatedItems:1,missingItems:1,failedItems:0,startedAt:"2026-08-14T20:00:00Z",
  completedAt:"2026-08-14T20:01:00Z",createdAt:"2026-08-14T20:00:00Z",
};

const currencies: readonly CurrencyDTO[] = [
  { code: "TRY", nameTr: "TÜRK LİRASI", nameEn: "TURKISH LIRA", isEnabled: true },
  { code: "USD", nameTr: "ABD DOLARI", nameEn: "US DOLLAR", isEnabled: true },
  { code: "EUR", nameTr: "EURO", nameEn: "EURO", isEnabled: false },
];

function settingsModel(
  categories: readonly CategoryDTO[] = [category],
  costCenters: readonly CostCenterDTO[] = [],
): SettingsViewModel {
  return {
    apiBaseUrl: "https://api.example.test",
    apiStatus: { online: true, reason: "Canlı API yanıt veriyor." },
    book: { name: "Kişisel Defter", baseCurrency: "TRY" },
    accountTypes: [],
    categories,
    costCenters,
    currencies,
    instruments: [],
    investmentTypes: [],
    user: { displayName: "Nihat Kaya", email: "nihat@example.test" },
  };
}

function settingsActions(overrides: Partial<SettingsActions> = {}): SettingsActions {
  return {
    onActivateAccountType: vi.fn(() => Promise.resolve()),
    onActivateCategory: vi.fn(() => Promise.resolve()),
    onActivateCostCenter: vi.fn(() => Promise.resolve()),
    onActivateInstrument: vi.fn(() => Promise.resolve()),
    onActivateInvestmentType: vi.fn(() => Promise.resolve()),
    onDeleteAccountType: vi.fn(() => Promise.resolve()),
    onDeleteCategory: vi.fn(() => Promise.resolve()),
    onDeleteCostCenter: vi.fn(() => Promise.resolve()),
    onDeleteInstrument: vi.fn(() => Promise.resolve()),
    onDeleteInvestmentType: vi.fn(() => Promise.resolve()),
    onLogout: vi.fn(() => Promise.resolve()),
    onChangePassword: vi.fn(() => Promise.resolve()),
    onSaveAccountType: vi.fn(() => Promise.resolve()),
    onSaveCategory: vi.fn(() => Promise.resolve()),
    onSaveCostCenter: vi.fn(() => Promise.resolve()),
    onSaveInstrument: vi.fn(() => Promise.resolve()),
    onSaveInstrumentPrice: vi.fn(() => Promise.resolve()),
    onSaveInvestmentType: vi.fn(() => Promise.resolve()),
    onSearchMarketSymbols: vi.fn(() => Promise.resolve([])),
    onLoadInstrumentPrices: vi.fn(() => Promise.resolve([])),
    onSyncMarketPrices: vi.fn(() => Promise.reject(new Error("unused"))),
    onMarketPriceSyncStatus: vi.fn(() => Promise.resolve(null)),
    onEnableCurrency: vi.fn(() => Promise.resolve()),
    onDisableCurrency: vi.fn(() => Promise.resolve()),
    onLoadCurrencyRates: vi.fn(() => Promise.resolve([])),
    onSyncCurrencyRates: vi.fn(() => Promise.reject(new Error("unused"))),
    onCurrencyRateSyncStatus: vi.fn(() => Promise.resolve(null)),
    ...overrides,
  };
}

describe("SettingsPage category management", () => {
  it("changes the password from the profile security dialog", async () => {
    const user = userEvent.setup();
    const onChangePassword = vi.fn(() => Promise.resolve());

    render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({ onChangePassword })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Şifreyi değiştir" }));
    const dialog = screen.getByRole("dialog", { name: "Şifreyi değiştir" });
    await user.type(screen.getByLabelText("Mevcut şifre"), "EskiGucluSifre123!");
    await user.type(screen.getByLabelText("Yeni şifre"), "YeniGucluSifre123!");
    await user.type(screen.getByLabelText("Yeni şifre tekrarı"), "YeniGucluSifre123!");
    await user.click(screen.getByRole("button", { name: "Şifreyi güncelle" }));

    await waitFor(() =>
      expect(onChangePassword).toHaveBeenCalledWith({
        currentPassword: "EskiGucluSifre123!",
        newPassword: "YeniGucluSifre123!",
      }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("creates a category and closes only after the callback succeeds", async () => {
    const user = userEvent.setup();
    const onSaveCategory = vi.fn(() => Promise.resolve());

    render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({ onSaveCategory })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "+ Kategori" }));
    const dialog = screen.getByRole("dialog", { name: "Kategori" });
    await user.type(screen.getByLabelText("Ad"), "Maaş");
    await user.selectOptions(screen.getByLabelText("Tür"), "INCOME");
    await user.clear(screen.getByLabelText("Sıra"));
    await user.type(screen.getByLabelText("Sıra"), "20");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() =>
      expect(onSaveCategory).toHaveBeenCalledWith({
        mode: "create",
        categoryType: "INCOME",
        name: "Maaş",
        sortOrder: 20,
      }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("edits name and order while keeping the established category type immutable", async () => {
    const user = userEvent.setup();
    const onSaveCategory = vi.fn(() => Promise.resolve());

    render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({ onSaveCategory })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Düzenle" }));
    expect(screen.getByLabelText("Tür")).toBeDisabled();
    expect(screen.getByLabelText("Ad")).toHaveValue("Market");
    await user.clear(screen.getByLabelText("Ad"));
    await user.type(screen.getByLabelText("Ad"), "Ev marketi");
    await user.clear(screen.getByLabelText("Sıra"));
    await user.type(screen.getByLabelText("Sıra"), "4");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() =>
      expect(onSaveCategory).toHaveBeenCalledWith({
        mode: "update",
        id: "category-1",
        name: "Ev marketi",
        sortOrder: 4,
        version: 3,
      }),
    );
  });

  it("closes a blank category form without submitting or triggering validation", async () => {
    const user = userEvent.setup();
    const onSaveCategory = vi.fn(() => Promise.resolve());

    render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({ onSaveCategory })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "+ Kategori" }));
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(onSaveCategory).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Kategori" })).not.toBeInTheDocument();
  });

  it("keeps a rejected save error inside the open category dialog", async () => {
    const user = userEvent.setup();
    const onSaveCategory = vi.fn(() =>
      Promise.reject(new Error("Kategori adı zaten kullanılıyor.")),
    );

    render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({ onSaveCategory })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "+ Kategori" }));
    await user.type(screen.getByLabelText("Ad"), "Market");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Kategori adı zaten kullanılıyor.");
    expect(error.closest("dialog")).toBe(
      screen.getByRole("dialog", { name: "Kategori" }),
    );
  });
});

describe("SettingsPage cost center management", () => {
  it("creates a cost center with its optional description and order", async () => {
    const user = userEvent.setup();
    const onSaveCostCenter = vi.fn(() => Promise.resolve());

    render(
      <SettingsPage
        model={settingsModel([], [])}
        actions={settingsActions({ onSaveCostCenter })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "+ Masraf merkezi" }));
    const dialog = screen.getByRole("dialog", { name: "Masraf merkezi" });
    await user.type(screen.getByLabelText("Ad"), "Aile arabası");
    await user.type(screen.getByLabelText("Açıklama"), "Yakıt ve bakım");
    await user.clear(screen.getByLabelText("Sıra"));
    await user.type(screen.getByLabelText("Sıra"), "12");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onSaveCostCenter).toHaveBeenCalledWith({
        mode: "create",
        name: "Aile arabası",
        description: "Yakıt ve bakım",
        sortOrder: 12,
      });
    });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("edits an existing cost center", async () => {
    const user = userEvent.setup();
    const onSaveCostCenter = vi.fn(() => Promise.resolve());
    const { container } = render(
      <SettingsPage
        model={settingsModel([], [activeCostCenter])}
        actions={settingsActions({ onSaveCostCenter })}
      />,
    );

    await user.click(
      container.querySelector<HTMLButtonElement>(
        `[data-edit-cost-center="${activeCostCenter.id}"]`,
      )!,
    );
    expect(screen.getByLabelText("Ad")).toHaveValue("Aile arabası");
    await user.clear(screen.getByLabelText("Ad"));
    await user.type(screen.getByLabelText("Ad"), "Günlük araç");
    await user.clear(screen.getByLabelText("Açıklama"));
    await user.type(screen.getByLabelText("Açıklama"), "Yeni açıklama");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onSaveCostCenter).toHaveBeenCalledWith({
        mode: "update",
        id: activeCostCenter.id,
        version: activeCostCenter.version,
        name: "Günlük araç",
        description: "Yeni açıklama",
        sortOrder: activeCostCenter.sortOrder,
      });
    });
  });

  it("deactivates an active cost center and reactivates an inactive one", async () => {
    const user = userEvent.setup();
    const onDeleteCostCenter = vi.fn(() => Promise.resolve());
    const onActivateCostCenter = vi.fn(() => Promise.resolve());
    const confirmAction = vi.fn(() => true);
    const { container } = render(
      <SettingsPage
        model={settingsModel([], [activeCostCenter, inactiveCostCenter])}
        actions={settingsActions({ onDeleteCostCenter, onActivateCostCenter })}
        confirmAction={confirmAction}
      />,
    );

    await user.click(
      container.querySelector<HTMLButtonElement>(
        `[data-delete-cost-center="${activeCostCenter.id}"]`,
      )!,
    );
    await waitFor(() => {
      expect(onDeleteCostCenter).toHaveBeenCalledWith({
        id: activeCostCenter.id,
        version: activeCostCenter.version,
      });
    });
    expect(confirmAction).toHaveBeenCalledWith(
      expect.stringContaining(activeCostCenter.name),
    );

    await user.click(
      container.querySelector<HTMLButtonElement>(
        `[data-activate-cost-center="${inactiveCostCenter.id}"]`,
      )!,
    );
    await waitFor(() => {
      expect(onActivateCostCenter).toHaveBeenCalledWith({
        id: inactiveCostCenter.id,
        version: inactiveCostCenter.version,
      });
    });
  });
});

describe("SettingsPage account type management",()=>{
  it("edits a custom account type's name, balance direction and sort order",async()=>{
    const user=userEvent.setup();
    const onSaveAccountType=vi.fn(()=>Promise.resolve());
    const { container }=render(<SettingsPage model={{...settingsModel(),accountTypes:[accountType]}} actions={settingsActions({
      onSaveAccountType,
    })}/>);

    await user.click(container.querySelector<HTMLButtonElement>('[data-edit-account-type="account-type-1"]')!);
    const dialog=await screen.findByRole("dialog",{name:"Hesap türü"});
    expect(within(dialog).getByLabelText("Bakiye yönü")).toBeEnabled();
    await user.clear(within(dialog).getByLabelText("Tür adı"));
    await user.type(within(dialog).getByLabelText("Tür adı"),"Vadesiz");
    await user.selectOptions(within(dialog).getByLabelText("Bakiye yönü"),"CREDIT");
    await user.clear(within(dialog).getByLabelText("Sıra"));
    await user.type(within(dialog).getByLabelText("Sıra"),"5");
    await user.click(within(dialog).getByRole("button",{name:"Kaydet"}));

    await waitFor(()=>expect(onSaveAccountType).toHaveBeenCalledWith({
      mode:"update",id:"account-type-1",name:"Vadesiz",
      normalBalance:"CREDIT",defaultAllowNegativeBalance:false,sortOrder:5,version:1,
    }));
  });

  it("locks the balance direction for a type tied to a system role",async()=>{
    const user=userEvent.setup();
    const purposeLockedType:AccountTypeDTO={...accountType,id:"account-type-2",name:"Tedarikçi",purpose:"SUPPLIER"};
    const { container }=render(<SettingsPage model={{...settingsModel(),accountTypes:[purposeLockedType]}} actions={settingsActions()}/>);

    await user.click(container.querySelector<HTMLButtonElement>('[data-edit-account-type="account-type-2"]')!);
    const dialog=await screen.findByRole("dialog",{name:"Hesap türü"});
    expect(within(dialog).getByLabelText("Bakiye yönü")).toBeDisabled();
  });

  it("creates a custom account type with its own balance direction",async()=>{
    const user=userEvent.setup();
    const onSaveAccountType=vi.fn(()=>Promise.resolve());
    const { container }=render(<SettingsPage model={settingsModel()} actions={settingsActions({
      onSaveAccountType,
    })}/>);

    await user.click(container.querySelector<HTMLButtonElement>("#open-account-type-dialog")!);
    const dialog=await screen.findByRole("dialog",{name:"Hesap türü"});
    await user.type(within(dialog).getByLabelText("Tür adı"),"Kredi kartı 2");
    await user.selectOptions(within(dialog).getByLabelText("Bakiye yönü"),"CREDIT");
    await user.click(within(dialog).getByLabelText("Yeni hesaplarda eksi bakiyeye varsayılan olarak izin ver"));
    await user.click(within(dialog).getByRole("button",{name:"Kaydet"}));

    await waitFor(()=>expect(onSaveAccountType).toHaveBeenCalledWith({
      mode:"create",name:"Kredi kartı 2",
      normalBalance:"CREDIT",defaultAllowNegativeBalance:true,sortOrder:0,
    }));
  });
});

describe("SettingsPage automatic market prices",()=>{
  it("shows a missing selected-day price as zero and queues a whole-market refresh",async()=>{
    const user=userEvent.setup();
    const onSyncMarketPrices=vi.fn(()=>Promise.resolve(completedRun));
    render(<SettingsPage model={{...settingsModel(),instruments:[linkedInstrument],investmentTypes:[investmentType]}} actions={settingsActions({
      onLoadInstrumentPrices:vi.fn(()=>Promise.resolve([{instrumentId:"instrument-1",priceDate:"2026-08-14",price:"0",available:false,source:"MISSING" as const}])),
      onSyncMarketPrices,
    })}/>);
    expect(await screen.findByText(/O gün fiyat yok/)).toHaveTextContent("0,00");
    await user.click(screen.getByRole("button",{name:"Fiyatı güncelle"}));
    await waitFor(()=>expect(onSyncMarketPrices).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)));
  });

  it("selects a searchable Yahoo code while defining an instrument",async()=>{
    const user=userEvent.setup();
    const onSaveInstrument=vi.fn(()=>Promise.resolve());
    const onSearchMarketSymbols=vi.fn(()=>Promise.resolve([{
      id:"market-aapl",providerSymbol:"AAPL",exchangeCode:"NASDAQ",market:"US" as const,
      instrumentType:"EQUITY" as const,name:"Apple Inc.",currencyCode:"USD" as const,
    }]));
    render(<SettingsPage model={{...settingsModel(),investmentTypes:[investmentType]}} actions={settingsActions({
      onSaveInstrument,onSearchMarketSymbols,
    })}/>);
    await user.click(screen.getByRole("button",{name:"+ Araç"}));
    await user.selectOptions(screen.getByLabelText("Tür"),"type-1");
    await user.type(screen.getByLabelText("Borsa kodu ara"),"AAPL");
    await waitFor(()=>expect(screen.getByRole("option",{name:/AAPL · Apple Inc\./})).toBeInTheDocument());
    await user.selectOptions(screen.getByLabelText(/^Yahoo Finance kodu/),"market-aapl");
    expect(screen.getByLabelText("Sembol")).toHaveValue("AAPL");
    expect(screen.getByLabelText("Ad")).toHaveValue("Apple Inc.");
    await user.click(screen.getByRole("button",{name:"Kaydet"}));
    await waitFor(()=>expect(onSaveInstrument).toHaveBeenCalledWith(expect.objectContaining({
      mode:"create",marketSymbolId:"market-aapl",symbol:"AAPL",name:"Apple Inc.",
    })));
  });
});

describe("SettingsPage currency management",()=>{
  it("adds and removes a currency and shows its TCMB rate for the selected date",async()=>{
    const user=userEvent.setup();
    const onEnableCurrency=vi.fn(()=>Promise.resolve());
    const onDisableCurrency=vi.fn(()=>Promise.resolve());
    const confirmAction=vi.fn(()=>true);
    const { container }=render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({
          onEnableCurrency,onDisableCurrency,
          onLoadCurrencyRates:vi.fn(()=>Promise.resolve([
            {currencyCode:"USD",rateDate:"2026-08-14",tryRate:"47.8293",available:true,source:"TCMB" as const},
          ])),
        })}
        confirmAction={confirmAction}
      />,
    );

    expect(await screen.findByText(/47,8293/)).toBeInTheDocument();
    expect(container.querySelector('[data-enable-currency="EUR"]')).toBeInTheDocument();
    expect(container.querySelector('[data-disable-currency="TRY"]')).not.toBeInTheDocument();

    await user.click(container.querySelector<HTMLButtonElement>('[data-enable-currency="EUR"]')!);
    await waitFor(()=>expect(onEnableCurrency).toHaveBeenCalledWith("EUR"));

    await user.click(container.querySelector<HTMLButtonElement>('[data-disable-currency="USD"]')!);
    await waitFor(()=>expect(onDisableCurrency).toHaveBeenCalledWith("USD"));
    expect(confirmAction).toHaveBeenCalledWith(expect.stringContaining("ABD DOLARI"));
  });

  it("offers only TRY and enabled currencies when defining a manual instrument",async()=>{
    const user=userEvent.setup();
    const onSaveInstrument=vi.fn(()=>Promise.resolve());
    render(<SettingsPage model={{...settingsModel(),investmentTypes:[investmentType]}} actions={settingsActions({
      onSaveInstrument,
    })}/>);
    await user.click(screen.getByRole("button",{name:"+ Araç"}));
    await user.selectOptions(screen.getByLabelText("Tür"),"type-1");
    const currencySelect=screen.getByLabelText("Para birimi");
    expect([...(currencySelect as HTMLSelectElement).options].map((option)=>option.value)).toEqual(["TRY","USD"]);
    await user.selectOptions(currencySelect,"USD");
    await user.type(screen.getByLabelText("Ad"),"Yurt dışı fon");
    await user.click(screen.getByRole("button",{name:"Kaydet"}));
    await waitFor(()=>expect(onSaveInstrument).toHaveBeenCalledWith(expect.objectContaining({
      mode:"create",currencyCode:"USD",name:"Yurt dışı fon",
    })));
  });
});
