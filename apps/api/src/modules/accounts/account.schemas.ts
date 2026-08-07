import { z } from "zod";
import { currency, nonnegativeMoney, uuid } from "../../common/schemas";

const accountType = z.enum([
  "CASH", "BANK", "CREDIT_CARD", "CUSTOMER", "SUPPLIER", "RECEIVABLE",
  "PAYABLE", "SAVINGS", "BUDGET", "PERSONNEL", "OTHER"
]);

export const createAccountSchema = z.object({
  bookId: uuid,
  name: z.string().trim().min(1).max(120),
  accountType,
  normalBalance: z.enum(["DEBIT", "CREDIT"]).optional(),
  currencyCode: currency,
  allowNegativeBalance: z.boolean().optional(),
  creditLimit: nonnegativeMoney.nullable().optional(),
  openingBalance: nonnegativeMoney.default("0"),
  isArchived: z.boolean().default(false),
  sortOrder: z.number().int().default(0)
});

export const updateAccountSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  accountType: accountType.optional(),
  allowNegativeBalance: z.boolean().optional(),
  creditLimit: nonnegativeMoney.nullable().optional(),
  isArchived: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  version: z.number().int().positive()
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
