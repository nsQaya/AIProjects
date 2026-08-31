import type {
  AccountTypeDTO,
  BookDTO,
  CategoryDTO,
  CategoryType,
  CostCenterDTO,
  CurrencyDTO,
  CurrencyRateAtDateDTO,
  CurrencyRateSyncRunDTO,
  Direction,
  InvestmentAssetTypeDTO,
  InvestmentInstrumentDTO,
  InvestmentPriceAtDateDTO,
  MarketPriceSyncRunDTO,
  MarketSymbolDTO,
  MoneyString,
  UserDTO,
  Version,
} from "@defterx/contracts";

export interface SettingsApiStatus {
  online: boolean;
  reason?: string | null;
}

export interface SettingsViewModel {
  apiBaseUrl: string;
  apiStatus: SettingsApiStatus;
  book: Pick<BookDTO, "baseCurrency" | "name"> | null;
  accountTypes: readonly AccountTypeDTO[];
  categories: readonly CategoryDTO[];
  costCenters: readonly CostCenterDTO[];
  currencies: readonly CurrencyDTO[];
  instruments: readonly InvestmentInstrumentDTO[];
  investmentTypes: readonly InvestmentAssetTypeDTO[];
  user: Pick<UserDTO, "displayName" | "email"> | null;
}

export type SaveCategoryInput =
  | {
      mode: "create";
      categoryType: CategoryType;
      name: string;
      sortOrder: number;
    }
  | {
      mode: "update";
      id: string;
      name: string;
      sortOrder: number;
      version: Version;
    };

export type SaveCostCenterInput =
  | {
      mode: "create";
      name: string;
      description: string | null;
      sortOrder: number;
    }
  | {
      mode: "update";
      id: string;
      name: string;
      description: string | null;
      sortOrder: number;
      version: Version;
    };

export type SaveInvestmentTypeInput =
  | {
      mode: "create";
      name: string;
      sortOrder: number;
    }
  | {
      mode: "update";
      id: string;
      name: string;
      sortOrder: number;
      version: Version;
    };

export type SaveAccountTypeInput =
  | {
      mode: "create";
      name: string;
      normalBalance: Direction;
      defaultAllowNegativeBalance: boolean;
      isInvestment: boolean;
      sortOrder: number;
    }
  | {
      mode: "update";
      id: string;
      name: string;
      normalBalance: Direction;
      defaultAllowNegativeBalance: boolean;
      isInvestment: boolean;
      sortOrder: number;
      version: Version;
    };

export type SaveInstrumentInput =
  | {
      mode: "create";
      assetTypeId: string;
      name: string;
      symbol: string | null;
      marketSymbolId: string | null;
      /** Ignored when marketSymbolId is set — the linked market symbol's currency wins. */
      currencyCode: string;
    }
  | {
      mode: "update";
      assetTypeId: string;
      id: string;
      name: string;
      symbol: string | null;
      marketSymbolId: string | null;
      /** Ignored when marketSymbolId is set — the linked market symbol's currency wins. */
      currencyCode: string;
      version: Version;
    };

export interface SaveInstrumentPriceInput {
  instrumentId: string;
  price: MoneyString;
  pricedAt: string;
}

export interface VersionedSettingsEntity {
  id: string;
  version: Version;
}

export interface SettingsActions {
  onActivateAccountType: (entity: VersionedSettingsEntity) => Promise<void>;
  onActivateCategory: (entity: VersionedSettingsEntity) => Promise<void>;
  onActivateCostCenter: (entity: VersionedSettingsEntity) => Promise<void>;
  onActivateInstrument: (entity: VersionedSettingsEntity) => Promise<void>;
  onActivateInvestmentType: (entity: VersionedSettingsEntity) => Promise<void>;
  onDeleteAccountType: (entity: VersionedSettingsEntity) => Promise<void>;
  onDeleteCategory: (entity: VersionedSettingsEntity) => Promise<void>;
  onDeleteCostCenter: (entity: VersionedSettingsEntity) => Promise<void>;
  onDeleteInstrument: (entity: VersionedSettingsEntity) => Promise<void>;
  onDeleteInvestmentType: (entity: VersionedSettingsEntity) => Promise<void>;
  onLogout: () => Promise<void>;
  onChangePassword: (input: {
    currentPassword: string;
    newPassword: string;
  }) => Promise<void>;
  onSaveAccountType: (input: SaveAccountTypeInput) => Promise<void>;
  onSaveCategory: (input: SaveCategoryInput) => Promise<void>;
  onSaveCostCenter: (input: SaveCostCenterInput) => Promise<void>;
  onSaveInstrument: (input: SaveInstrumentInput) => Promise<void>;
  onSaveInstrumentPrice: (input: SaveInstrumentPriceInput) => Promise<void>;
  onSaveInvestmentType: (input: SaveInvestmentTypeInput) => Promise<void>;
  onSearchMarketSymbols: (query: string, market?: "BIST" | "US") => Promise<readonly MarketSymbolDTO[]>;
  onLoadInstrumentPrices: (date: string) => Promise<readonly InvestmentPriceAtDateDTO[]>;
  onSyncMarketPrices: (date: string) => Promise<MarketPriceSyncRunDTO>;
  onMarketPriceSyncStatus: (date: string) => Promise<MarketPriceSyncRunDTO | null>;
  onEnableCurrency: (code: string) => Promise<void>;
  onDisableCurrency: (code: string) => Promise<void>;
  onLoadCurrencyRates: (date: string) => Promise<readonly CurrencyRateAtDateDTO[]>;
  onSyncCurrencyRates: (date: string) => Promise<CurrencyRateSyncRunDTO>;
  onCurrencyRateSyncStatus: (date: string) => Promise<CurrencyRateSyncRunDTO | null>;
}

export type ConfirmSettingsAction = (message: string) => boolean;
