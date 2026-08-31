import { z } from "zod";
import { uuid, version } from "../../common/schemas";

export const createAccountTypeSchema = z.object({
  bookId: uuid,
  name: z.string().trim().min(1).max(80),
  icon: z.string().trim().max(50).nullable().optional(),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  defaultAllowNegativeBalance: z.boolean().default(false),
  isInvestment: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const updateAccountTypeSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  icon: z.string().trim().max(50).nullable().optional(),
  normalBalance: z.enum(["DEBIT", "CREDIT"]).optional(),
  defaultAllowNegativeBalance: z.boolean().optional(),
  isInvestment: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  version,
});

export type CreateAccountTypeInput = z.infer<typeof createAccountTypeSchema>;
export type UpdateAccountTypeInput = z.infer<typeof updateAccountTypeSchema>;
