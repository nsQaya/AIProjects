import type {
  CurrencyCode,
  DeletedEntityResponse,
  ISODateTimeString,
  ItemListResponse,
  MoneyString,
  UUID,
  Version,
} from "./common.js";

export interface InvestmentAssetTypeDTO {
  id: UUID;
  bookId: UUID;
  name: string;
  icon: string | null;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  version: Version;
}

export interface CreateInvestmentAssetTypeRequest {
  bookId: UUID;
  name: string;
  icon?: string | null;
  sortOrder?: number;
}

export interface UpdateInvestmentAssetTypeRequest {
  name?: string;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
  version: Version;
}

export type InvestmentAssetTypeListResponse = ItemListResponse<InvestmentAssetTypeDTO>;
export type CreateInvestmentAssetTypeResponse = InvestmentAssetTypeDTO;
export type UpdateInvestmentAssetTypeResponse = InvestmentAssetTypeDTO;

export interface ListInvestmentAssetTypesQuery {
  bookId: UUID;
  includeInactive?: boolean;
}

export interface DeactivatedInvestmentEntityResponse {
  id: UUID;
  isActive: false;
  version: Version;
}

export type DeleteInvestmentAssetTypeResponse = DeletedEntityResponse | DeactivatedInvestmentEntityResponse;

export interface InvestmentInstrumentDTO {
  id: UUID;
  bookId: UUID;
  assetTypeId: UUID;
  assetTypeName: string;
  name: string;
  symbol: string | null;
  marketSymbolId: UUID | null;
  providerSymbol: string | null;
  currencyCode: CurrencyCode;
  isActive: boolean;
  version: Version;
  latestPrice: MoneyString | null;
  latestPriceAt: ISODateTimeString | null;
}

export interface CreateInvestmentInstrumentRequest {
  bookId: UUID;
  assetTypeId: UUID;
  name: string;
  symbol?: string | null;
  marketSymbolId?: UUID | null;
  currencyCode: CurrencyCode;
}

export interface UpdateInvestmentInstrumentRequest {
  assetTypeId?: UUID;
  name?: string;
  symbol?: string | null;
  marketSymbolId?: UUID | null;
  currencyCode?: CurrencyCode;
  isActive?: boolean;
  version: Version;
}

export type InvestmentInstrumentListResponse = ItemListResponse<InvestmentInstrumentDTO>;
export type CreateInvestmentInstrumentResponse = InvestmentInstrumentDTO;
export type UpdateInvestmentInstrumentResponse = InvestmentInstrumentDTO;
export type DeleteInvestmentInstrumentResponse = DeletedEntityResponse | DeactivatedInvestmentEntityResponse;

export interface ListInvestmentInstrumentsQuery {
  bookId: UUID;
  includeInactive?: boolean;
}

export interface SetInvestmentPriceRequest {
  price: MoneyString;
  pricedAt: ISODateTimeString;
}

export interface InvestmentPriceDTO {
  id: UUID;
  instrumentId: UUID;
  price: MoneyString;
  pricedAt: ISODateTimeString;
}

export type SetInvestmentPriceResponse = InvestmentPriceDTO;

export interface MarketSymbolDTO {
  id: UUID;
  providerSymbol: string;
  exchangeCode: string;
  market: "US" | "BIST";
  instrumentType: "EQUITY" | "ETF" | "FUND" | "OTHER";
  name: string;
  currencyCode: CurrencyCode;
}

export type MarketSymbolListResponse = ItemListResponse<MarketSymbolDTO>;

export interface InvestmentPriceAtDateDTO {
  instrumentId: UUID;
  priceDate: string;
  price: MoneyString;
  available: boolean;
  source: "YAHOO" | "YAHOO_LIVE" | "MANUAL" | "MISSING";
}

export type InvestmentPricesAtDateResponse = ItemListResponse<InvestmentPriceAtDateDTO>;

export interface MarketPriceSyncRunDTO {
  id: UUID;
  kind: "PRICES";
  targetDate: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  totalItems: number;
  processedItems: number;
  updatedItems: number;
  missingItems: number;
  failedItems: number;
  startedAt: ISODateTimeString | null;
  completedAt: ISODateTimeString | null;
  createdAt: ISODateTimeString;
}

export interface InvestmentLotDTO {
  id: UUID;
  bookId: UUID;
  instrumentId: UUID;
  instrumentName: string;
  symbol: string | null;
  currencyCode: CurrencyCode;
  accountId: UUID | null;
  accountName: string | null;
  quantity: MoneyString;
  unitPrice: MoneyString;
  costBasis: MoneyString;
  purchasedAt: ISODateTimeString;
  notes: string | null;
  /** PURCHASE for an ordinary buy; CAPITAL_INCREASE for a bonus/rights issue or a manual split. */
  kind: "PURCHASE" | "CAPITAL_INCREASE";
  /** True when a ledger transaction moved cash out of the brokerage account for this lot. */
  posted: boolean;
  version: Version;
}

export interface CreateInvestmentLotRequest {
  bookId: UUID;
  instrumentId: UUID;
  accountId?: UUID | null;
  quantity: MoneyString;
  unitPrice: MoneyString;
  purchasedAt: ISODateTimeString;
  notes?: string | null;
}

export interface UpdateInvestmentLotRequest {
  instrumentId?: UUID;
  accountId?: UUID | null;
  quantity?: MoneyString;
  unitPrice?: MoneyString;
  purchasedAt?: ISODateTimeString;
  notes?: string | null;
  version: Version;
}

export interface CreateInvestmentCapitalIncreaseRequest {
  bookId: UUID;
  instrumentId: UUID;
  /** The position's new total open quantity after the bonus/rights issue or split. */
  newTotalQuantity: MoneyString;
  /** Cash paid to subscribe; "0" for a bonus issue or a plain split. */
  amountPaid: MoneyString;
  /** Brokerage account the payment leaves; required when amountPaid > 0. */
  accountId?: UUID | null;
  effectiveAt: ISODateTimeString;
  notes?: string | null;
}

export type InvestmentLotListResponse = ItemListResponse<InvestmentLotDTO>;
export type CreateInvestmentLotResponse = InvestmentLotDTO;
export type UpdateInvestmentLotResponse = InvestmentLotDTO;
export type DeleteInvestmentLotResponse = DeletedEntityResponse;
export type CreateInvestmentCapitalIncreaseResponse = InvestmentLotDTO;

export interface ListInvestmentLotsQuery {
  bookId: UUID;
}

export interface InvestmentPortfolioItemDTO {
  instrumentId: UUID;
  name: string;
  symbol: string | null;
  assetTypeName: string;
  currencyCode: CurrencyCode;
  quantity: MoneyString;
  costBasis: MoneyString;
  realizedGain: MoneyString;
  latestPrice: MoneyString | null;
  latestPriceAt: ISODateTimeString | null;
  currentValue: MoneyString | null;
  gain: MoneyString | null;
  gainPercent: MoneyString | null;
  /** costBasis/currentValue/gain converted to TRY using the latest known TCMB rate; equal to the plain fields when currencyCode is already TRY, null when a foreign-currency instrument has no rate yet. */
  costBasisTRY: MoneyString | null;
  currentValueTRY: MoneyString | null;
  gainTRY: MoneyString | null;
}

export type InvestmentPortfolioResponse = ItemListResponse<InvestmentPortfolioItemDTO>;

export interface GetInvestmentPortfolioQuery {
  bookId: UUID;
}

export interface InvestmentSaleDTO {
  id: UUID;
  bookId: UUID;
  instrumentId: UUID;
  instrumentName: string;
  symbol: string | null;
  currencyCode: CurrencyCode;
  destinationAccountId: UUID;
  destinationAccountName: string;
  transactionId: UUID;
  quantity: MoneyString;
  unitPrice: MoneyString;
  proceeds: MoneyString;
  costBasis: MoneyString;
  gain: MoneyString;
  soldAt: ISODateTimeString;
  notes: string | null;
  version: Version;
}

export interface CreateInvestmentSaleRequest {
  bookId: UUID;
  instrumentId: UUID;
  destinationAccountId: UUID;
  quantity: MoneyString;
  unitPrice: MoneyString;
  soldAt: ISODateTimeString;
  notes?: string | null;
  clientOperationId: UUID;
}

export interface UpdateInvestmentSaleRequest {
  instrumentId: UUID;
  destinationAccountId: UUID;
  quantity: MoneyString;
  unitPrice: MoneyString;
  soldAt: ISODateTimeString;
  notes?: string | null;
  clientOperationId: UUID;
  /** Reverses the immutable ledger transaction created for the prior sale. */
  reversalClientOperationId: UUID;
  version: Version;
}

export type InvestmentSaleListResponse = ItemListResponse<InvestmentSaleDTO>;
export type CreateInvestmentSaleResponse = InvestmentSaleDTO;
export type UpdateInvestmentSaleResponse = InvestmentSaleDTO;
export type DeleteInvestmentSaleResponse = DeletedEntityResponse;

export interface ListInvestmentSalesQuery {
  bookId: UUID;
}

/** A brokerage/custodian account with its parked cash, shown per-account on the investments page. */
export interface InvestmentBrokerageAccountDTO {
  id: UUID;
  name: string;
  currencyCode: CurrencyCode;
  /** Available cash in the account's own currency. */
  displayBalance: MoneyString;
  /** displayBalance converted to the book base currency (TRY) at the latest rate; equal to displayBalance when the account is already TRY. */
  displayBalanceTry: MoneyString;
  isArchived: boolean;
}

export type InvestmentBrokerageAccountListResponse = ItemListResponse<InvestmentBrokerageAccountDTO>;

export interface ListInvestmentBrokerageAccountsQuery {
  bookId: UUID;
}
