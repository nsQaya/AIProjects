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
  currencyCode: CurrencyCode;
}

export interface UpdateInvestmentInstrumentRequest {
  assetTypeId?: UUID;
  name?: string;
  symbol?: string | null;
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

export interface InvestmentLotDTO {
  id: UUID;
  bookId: UUID;
  instrumentId: UUID;
  instrumentName: string;
  symbol: string | null;
  accountId: UUID | null;
  accountName: string | null;
  quantity: MoneyString;
  unitPrice: MoneyString;
  costBasis: MoneyString;
  purchasedAt: ISODateTimeString;
  notes: string | null;
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

export type InvestmentLotListResponse = ItemListResponse<InvestmentLotDTO>;
export type CreateInvestmentLotResponse = InvestmentLotDTO;
export type UpdateInvestmentLotResponse = InvestmentLotDTO;
export type DeleteInvestmentLotResponse = DeletedEntityResponse;

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
