import type { MoneyString, UUID, Version } from "@defterx/contracts";

import type { FxAccountOption, FxConversionValues } from "../fx";

/** Minimal account projection needed by investment purchase and sale forms. */
export interface InvestmentAccountOption {
  readonly id: UUID;
  readonly name: string;
  readonly isArchived: boolean;
}

/** A brokerage/custodian account with its available cash, shown as a card on the investments page. */
export interface InvestmentBrokerageAccount {
  readonly id: UUID;
  readonly name: string;
  readonly currencyCode: string;
  /** Cash in the account's own currency. */
  readonly displayBalance: MoneyString;
  /** displayBalance in the book base currency (TRY); equals displayBalance for a TRY account. */
  readonly displayBalanceTry: MoneyString;
  readonly isArchived: boolean;
}

/** Minimal instrument projection needed by investment forms. */
export interface InvestmentInstrumentOption {
  readonly id: UUID;
  readonly name: string;
  readonly symbol: string | null;
  readonly isActive: boolean;
  /** Set when the instrument tracks a market symbol (auto prices + auto ratio splits). */
  readonly marketSymbolId?: UUID | null;
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
  readonly costBasisTRY: MoneyString | null;
  readonly currentValueTRY: MoneyString | null;
  readonly gainTRY: MoneyString | null;
}

export interface InvestmentLotViewModel {
  readonly id: UUID;
  readonly instrumentId: UUID;
  readonly instrumentName: string;
  readonly symbol: string | null;
  readonly currencyCode: string;
  readonly accountId: UUID | null;
  readonly accountName: string | null;
  readonly quantity: MoneyString;
  readonly unitPrice: MoneyString;
  readonly costBasis: MoneyString;
  readonly purchasedAt: string;
  readonly notes: string | null;
  readonly kind: "PURCHASE" | "CAPITAL_INCREASE";
  readonly posted: boolean;
  readonly version: Version;
}

export interface InvestmentSaleViewModel {
  readonly id: UUID;
  readonly instrumentId: UUID;
  readonly instrumentName: string;
  readonly symbol: string | null;
  readonly currencyCode: string;
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

export interface CapitalIncreaseValues {
  readonly instrumentId: UUID;
  readonly newTotalQuantity: MoneyString;
  readonly amountPaid: MoneyString;
  readonly accountId: UUID | null;
  readonly effectiveAt: string;
  readonly notes: string | null;
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
  onCreateCapitalIncrease: (values: CapitalIncreaseValues) => InvestmentMutation;
  onCreateSale: (values: InvestmentSaleValues) => InvestmentMutation;
  onUpdateSale: (id: UUID, values: UpdateInvestmentSaleValues) => InvestmentMutation;
  onDeleteSale: (id: UUID, version: Version) => InvestmentMutation;
  onCreateFxConversion: (values: FxConversionValues) => InvestmentMutation;
}

export interface InvestmentsPageModel {
  readonly accounts: readonly InvestmentAccountOption[];
  readonly brokerageAccounts: readonly InvestmentBrokerageAccount[];
  /** Every non-system account (with its currency), for the döviz al/sat dialog. */
  readonly fxAccounts: readonly FxAccountOption[];
  readonly instruments: readonly InvestmentInstrumentOption[];
  readonly lots: readonly InvestmentLotViewModel[];
  readonly portfolio: readonly InvestmentPortfolioViewModel[];
  readonly sales: readonly InvestmentSaleViewModel[];
}
