import type { MoneyString, UUID, Version } from "@defterx/contracts";

/** Minimal account projection needed by investment purchase and sale forms. */
export interface InvestmentAccountOption {
  readonly id: UUID;
  readonly name: string;
  readonly isArchived: boolean;
}

/** Minimal instrument projection needed by investment forms. */
export interface InvestmentInstrumentOption {
  readonly id: UUID;
  readonly name: string;
  readonly symbol: string | null;
  readonly isActive: boolean;
}

export interface InvestmentPortfolioViewModel {
  readonly instrumentId: UUID;
  readonly name: string;
  readonly symbol: string | null;
  readonly assetTypeName: string;
  readonly currencyCode: string;
  readonly quantity: MoneyString;
  readonly costBasis: MoneyString;
  readonly realizedGain: MoneyString;
  readonly latestPrice: MoneyString | null;
  readonly latestPriceAt: string | null;
  readonly currentValue: MoneyString | null;
  readonly gain: MoneyString | null;
  readonly gainPercent: MoneyString | null;
}

export interface InvestmentLotViewModel {
  readonly id: UUID;
  readonly instrumentId: UUID;
  readonly instrumentName: string;
  readonly symbol: string | null;
  readonly accountId: UUID | null;
  readonly accountName: string | null;
  readonly quantity: MoneyString;
  readonly unitPrice: MoneyString;
  readonly costBasis: MoneyString;
  readonly purchasedAt: string;
  readonly notes: string | null;
  readonly version: Version;
}

export interface InvestmentSaleViewModel {
  readonly id: UUID;
  readonly instrumentId: UUID;
  readonly instrumentName: string;
  readonly symbol: string | null;
  readonly destinationAccountId: UUID;
  readonly destinationAccountName: string;
  readonly quantity: MoneyString;
  readonly unitPrice: MoneyString;
  readonly proceeds: MoneyString;
  readonly costBasis: MoneyString;
  readonly gain: MoneyString;
  readonly soldAt: string;
  readonly notes: string | null;
  readonly version: Version;
}

export interface InvestmentLotValues {
  readonly instrumentId: UUID;
  readonly accountId: UUID | null;
  readonly quantity: MoneyString;
  readonly unitPrice: MoneyString;
  readonly purchasedAt: string;
  readonly notes: string | null;
}

export interface UpdateInvestmentLotValues extends InvestmentLotValues {
  readonly version: Version;
}

export interface InvestmentSaleValues {
  readonly instrumentId: UUID;
  readonly destinationAccountId: UUID;
  readonly quantity: MoneyString;
  readonly unitPrice: MoneyString;
  readonly soldAt: string;
  readonly notes: string | null;
}

export interface UpdateInvestmentSaleValues extends InvestmentSaleValues {
  readonly version: Version;
}

export type InvestmentMutation = Promise<unknown>;

export interface InvestmentPageCallbacks {
  onCreateLot: (values: InvestmentLotValues) => InvestmentMutation;
  onUpdateLot: (id: UUID, values: UpdateInvestmentLotValues) => InvestmentMutation;
  onDeleteLot: (id: UUID, version: Version) => InvestmentMutation;
  onCreateSale: (values: InvestmentSaleValues) => InvestmentMutation;
  onUpdateSale: (id: UUID, values: UpdateInvestmentSaleValues) => InvestmentMutation;
  onDeleteSale: (id: UUID, version: Version) => InvestmentMutation;
}

export interface InvestmentsPageModel {
  readonly accounts: readonly InvestmentAccountOption[];
  readonly instruments: readonly InvestmentInstrumentOption[];
  readonly lots: readonly InvestmentLotViewModel[];
  readonly portfolio: readonly InvestmentPortfolioViewModel[];
  readonly sales: readonly InvestmentSaleViewModel[];
}
