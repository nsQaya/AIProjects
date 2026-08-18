import { z } from "zod";
import {
  currencyCodeSchema,
  decimalStringSchema,
  deletedEntitySchema,
  deactivatedEntitySchema,
  isoDateTimeSchema,
  itemListSchema,
  uuidSchema,
  versionSchema,
} from "./primitives";

export const investmentAssetTypeSchema = z.object({
  id: uuidSchema,
  bookId: uuidSchema,
  name: z.string(),
  icon: z.string().nullable(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  version: versionSchema,
});

export const investmentAssetTypeListSchema = itemListSchema(investmentAssetTypeSchema);
export const deleteInvestmentAssetTypeResponseSchema = z.union([
  deletedEntitySchema,
  deactivatedEntitySchema,
]);

export const investmentInstrumentSchema = z.object({
  id: uuidSchema,
  bookId: uuidSchema,
  assetTypeId: uuidSchema,
  assetTypeName: z.string(),
  name: z.string(),
  symbol: z.string().nullable(),
  marketSymbolId: uuidSchema.nullable(),
  providerSymbol: z.string().nullable(),
  currencyCode: currencyCodeSchema,
  isActive: z.boolean(),
  version: versionSchema,
  latestPrice: decimalStringSchema.nullable(),
  latestPriceAt: isoDateTimeSchema.nullable(),
});

export const investmentInstrumentListSchema = itemListSchema(investmentInstrumentSchema);
export const deleteInvestmentInstrumentResponseSchema = z.union([
  deletedEntitySchema,
  deactivatedEntitySchema,
]);

export const investmentPriceSchema = z.object({
  id: uuidSchema,
  instrumentId: uuidSchema,
  price: decimalStringSchema,
  pricedAt: isoDateTimeSchema,
});

export const marketSymbolSchema = z.object({
  id: uuidSchema,
  providerSymbol: z.string(),
  exchangeCode: z.string(),
  market: z.enum(["US","BIST"]),
  instrumentType: z.enum(["EQUITY","ETF","FUND","OTHER"]),
  name: z.string(),
  currencyCode: currencyCodeSchema,
});

export const marketSymbolListSchema = itemListSchema(marketSymbolSchema);

export const investmentPriceAtDateSchema = z.object({
  instrumentId: uuidSchema,
  priceDate: z.string(),
  price: decimalStringSchema,
  available: z.boolean(),
  source: z.enum(["YAHOO","MANUAL","MISSING"]),
});

export const investmentPricesAtDateSchema = itemListSchema(investmentPriceAtDateSchema);

export const marketPriceSyncRunSchema = z.object({
  id: uuidSchema,
  kind: z.literal("PRICES"),
  targetDate: z.string(),
  status: z.enum(["QUEUED","RUNNING","COMPLETED","FAILED"]),
  totalItems: z.number().int(),
  processedItems: z.number().int(),
  updatedItems: z.number().int(),
  missingItems: z.number().int(),
  failedItems: z.number().int(),
  startedAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const marketPriceSyncStatusSchema = z.object({run:marketPriceSyncRunSchema.nullable()});

export const investmentLotSchema = z.object({
  id: uuidSchema,
  bookId: uuidSchema,
  instrumentId: uuidSchema,
  instrumentName: z.string(),
  symbol: z.string().nullable(),
  currencyCode: currencyCodeSchema,
  accountId: uuidSchema.nullable(),
  accountName: z.string().nullable(),
  quantity: decimalStringSchema,
  unitPrice: decimalStringSchema,
  costBasis: decimalStringSchema,
  purchasedAt: isoDateTimeSchema,
  notes: z.string().nullable(),
  version: versionSchema,
});

export const investmentLotListSchema = itemListSchema(investmentLotSchema);
export const deleteInvestmentLotResponseSchema = deletedEntitySchema;

export const investmentPortfolioItemSchema = z.object({
  instrumentId: uuidSchema,
  name: z.string(),
  symbol: z.string().nullable(),
  assetTypeName: z.string(),
  currencyCode: currencyCodeSchema,
  quantity: decimalStringSchema,
  costBasis: decimalStringSchema,
  realizedGain: decimalStringSchema,
  latestPrice: decimalStringSchema.nullable(),
  latestPriceAt: isoDateTimeSchema.nullable(),
  currentValue: decimalStringSchema.nullable(),
  gain: decimalStringSchema.nullable(),
  gainPercent: decimalStringSchema.nullable(),
  costBasisTRY: decimalStringSchema.nullable(),
  currentValueTRY: decimalStringSchema.nullable(),
  gainTRY: decimalStringSchema.nullable(),
});

export const investmentPortfolioSchema = itemListSchema(investmentPortfolioItemSchema);

export const investmentSaleSchema = z.object({
  id: uuidSchema,
  bookId: uuidSchema,
  instrumentId: uuidSchema,
  instrumentName: z.string(),
  symbol: z.string().nullable(),
  currencyCode: currencyCodeSchema,
  destinationAccountId: uuidSchema,
  destinationAccountName: z.string(),
  transactionId: uuidSchema,
  quantity: decimalStringSchema,
  unitPrice: decimalStringSchema,
  proceeds: decimalStringSchema,
  costBasis: decimalStringSchema,
  gain: decimalStringSchema,
  soldAt: isoDateTimeSchema,
  notes: z.string().nullable(),
  version: versionSchema,
});

export const investmentSaleListSchema = itemListSchema(investmentSaleSchema);
export const deleteInvestmentSaleResponseSchema = deletedEntitySchema;
