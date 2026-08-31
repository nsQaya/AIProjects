import { z } from "zod";
import { currency, isoDate, money, uuid } from "../../common/schemas";

export const transactionMutationSchema=z.object({
  bookId:uuid,type:z.enum(['INCOME','EXPENSE','TRANSFER','SALE','PURCHASE','COLLECTION','PAYMENT','OPENING_BALANCE','ADJUSTMENT']),
  title:z.string().trim().min(1).max(200),amount:money,currencyCode:currency,accountId:uuid,targetAccountId:uuid.optional(),categoryId:uuid.optional(),costCenterId:uuid.nullable().optional(),contactId:uuid.optional(),
  transactionDate:isoDate,dueDate:isoDate.optional(),description:z.string().max(2000).optional(),clientOperationId:uuid,
});
export type TransactionMutationInput=z.infer<typeof transactionMutationSchema> & {
  /**
   * Internal only: book-base-currency (TRY) value of `amount`, used when a
   * posting spans currencies (FX-aware investment postings). Defaults to
   * `amount`. Stripped from any public POST /transactions payload by zod.
   */
  baseAmount?:string;
};
export const reversalSchema=z.object({clientOperationId:uuid,reason:z.string().trim().min(1).max(500)});
export const correctionSchema=z.object({
  reversalClientOperationId:uuid,
  reason:z.string().trim().min(1).max(500),
  replacement:transactionMutationSchema,
});
