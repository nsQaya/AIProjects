import { z } from "zod";
import { currency, isoDate, money, uuid, version } from "../../common/schemas";

export const createAssetTypeSchema = z.object({
  bookId:uuid,name:z.string().trim().min(1).max(80),icon:z.string().trim().max(50).nullable().optional(),sortOrder:z.number().int().default(0),
});
export const updateAssetTypeSchema = z.object({
  name:z.string().trim().min(1).max(80).optional(),icon:z.string().trim().max(50).nullable().optional(),
  sortOrder:z.number().int().optional(),isActive:z.boolean().optional(),version,
});
export const createInstrumentSchema = z.object({
  bookId:uuid,assetTypeId:uuid,name:z.string().trim().min(1).max(120),
  symbol:z.string().trim().min(1).max(40).nullable().optional(),currencyCode:currency,
  marketSymbolId:uuid.nullable().optional(),
});
export const updateInstrumentSchema = z.object({
  assetTypeId:uuid.optional(),name:z.string().trim().min(1).max(120).optional(),
  symbol:z.string().trim().min(1).max(40).nullable().optional(),marketSymbolId:uuid.nullable().optional(),
  currencyCode:currency.optional(),
  isActive:z.boolean().optional(),version,
});
export const createLotSchema = z.object({
  bookId:uuid,instrumentId:uuid,accountId:uuid.nullable().optional(),quantity:money,unitPrice:money,
  purchasedAt:isoDate,notes:z.string().max(1000).nullable().optional(),
});
export const updateLotSchema = z.object({
  instrumentId:uuid.optional(),accountId:uuid.nullable().optional(),quantity:money.optional(),unitPrice:money.optional(),
  purchasedAt:isoDate.optional(),notes:z.string().max(1000).nullable().optional(),version,
});
export const createPriceSchema = z.object({price:money,pricedAt:isoDate});
export const createSaleSchema = z.object({
  bookId:uuid,instrumentId:uuid,destinationAccountId:uuid,quantity:money,unitPrice:money,
  soldAt:isoDate,notes:z.string().max(1000).nullable().optional(),clientOperationId:uuid,
});
export const updateSaleSchema = createSaleSchema.omit({bookId:true}).extend({
  reversalClientOperationId:uuid,version,
});

export type CreateAssetTypeInput=z.infer<typeof createAssetTypeSchema>;
export type UpdateAssetTypeInput=z.infer<typeof updateAssetTypeSchema>;
export type CreateInstrumentInput=z.infer<typeof createInstrumentSchema>;
export type UpdateInstrumentInput=z.infer<typeof updateInstrumentSchema>;
export type CreateLotInput=z.infer<typeof createLotSchema>;
export type UpdateLotInput=z.infer<typeof updateLotSchema>;
export type CreatePriceInput=z.infer<typeof createPriceSchema>;
export type CreateSaleInput=z.infer<typeof createSaleSchema>;
export type UpdateSaleInput=z.infer<typeof updateSaleSchema>;
