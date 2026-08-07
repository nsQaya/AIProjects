import { z } from "zod";
import { currency, uuid } from "../../common/schemas";

export const createCategorySchema = z.object({
  bookId: uuid,
  parentId: uuid.nullable().optional(),
  name: z.string().trim().min(1).max(120),
  categoryType: z.enum(["INCOME", "EXPENSE"]),
  currencyCode: currency,
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().default(0)
});

export const updateCategorySchema = z.object({
  parentId: uuid.nullable().optional(),
  name: z.string().trim().min(1).max(120).optional(),
  icon: z.string().max(50).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().positive()
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
