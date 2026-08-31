import { z } from "zod";
import { isoDate, money, uuid } from "../../common/schemas";

export const createFxConversionSchema = z.object({
  bookId: uuid,
  fromAccountId: uuid,
  toAccountId: uuid,
  fromAmount: money,
  toAmount: money,
  transactionDate: isoDate,
  notes: z.string().max(2000).nullable().optional(),
  clientOperationId: uuid,
});

export type CreateFxConversionInput = z.infer<typeof createFxConversionSchema>;
