import type {
  BookDTO,
  CategoryDTO,
  CategoryType,
  CostCenterDTO,
  InvestmentAssetTypeDTO,
  InvestmentInstrumentDTO,
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
  categories: readonly CategoryDTO[];
  costCenters: readonly CostCenterDTO[];
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

export type SaveInstrumentInput =
  | {
      mode: "create";
      assetTypeId: string;
      name: string;
      symbol: string | null;
    }
  | {
      mode: "update";
      assetTypeId: string;
      id: string;
      name: string;
      symbol: string | null;
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
  onActivateCategory: (entity: VersionedSettingsEntity) => Promise<void>;
  onActivateCostCenter: (entity: VersionedSettingsEntity) => Promise<void>;
  onActivateInstrument: (entity: VersionedSettingsEntity) => Promise<void>;
  onActivateInvestmentType: (entity: VersionedSettingsEntity) => Promise<void>;
  onDeleteCategory: (entity: VersionedSettingsEntity) => Promise<void>;
  onDeleteCostCenter: (entity: VersionedSettingsEntity) => Promise<void>;
  onDeleteInstrument: (entity: VersionedSettingsEntity) => Promise<void>;
  onDeleteInvestmentType: (entity: VersionedSettingsEntity) => Promise<void>;
  onLogout: () => Promise<void>;
  onSaveCategory: (input: SaveCategoryInput) => Promise<void>;
  onSaveCostCenter: (input: SaveCostCenterInput) => Promise<void>;
  onSaveInstrument: (input: SaveInstrumentInput) => Promise<void>;
  onSaveInstrumentPrice: (input: SaveInstrumentPriceInput) => Promise<void>;
  onSaveInvestmentType: (input: SaveInvestmentTypeInput) => Promise<void>;
}

export type ConfirmSettingsAction = (message: string) => boolean;
