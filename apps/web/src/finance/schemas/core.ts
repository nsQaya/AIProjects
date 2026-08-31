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

export const bookSchema = z.object({
  id: uuidSchema,
  name: z.string(),
  bookType: z.enum(["PERSONAL", "BUSINESS", "OTHER"]),
  baseCurrency: currencyCodeSchema,
  version: versionSchema,
});

export const bookListItemSchema = bookSchema.extend({
  role: z.enum(["OWNER", "ADMIN", "EDITOR", "ACCOUNTANT", "VIEWER"]),
});

export const createdBookSchema = bookSchema.extend({
  createdAt: isoDateTimeSchema,
});

export const bookListSchema = itemListSchema(bookListItemSchema);

export const accountTypeSchema = z.object({
  id: uuidSchema,
  bookId: uuidSchema,
  name: z.string(),
  icon: z.string().nullable(),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  defaultAllowNegativeBalance: z.boolean(),
  purpose: z.enum([
    "SYSTEM_INCOME",
    "SYSTEM_EXPENSE",
    "SYSTEM_EQUITY",
    "CUSTOMER",
    "SUPPLIER",
    "OTHER",
  ]).nullable(),
  isInvestment: z.boolean(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  version: versionSchema,
});

export const accountTypeListSchema = itemListSchema(accountTypeSchema);
export const deleteAccountTypeResponseSchema = z.union([
  deletedEntitySchema,
  deactivatedEntitySchema,
]);

export const accountSchema = z.object({
  id: uuidSchema,
  bookId: uuidSchema,
  contactId: uuidSchema.nullable(),
  name: z.string(),
  accountTypeId: uuidSchema,
  accountTypeName: z.string(),
  accountTypeIcon: z.string().nullable(),
  isInvestment: z.boolean(),
  normalBalance: z.enum(["DEBIT", "CREDIT"]),
  currencyCode: currencyCodeSchema,
  allowNegativeBalance: z.boolean(),
  creditLimit: decimalStringSchema.nullable(),
  isArchived: z.boolean(),
  sortOrder: z.number().int(),
  version: versionSchema,
  balance: decimalStringSchema,
  displayBalance: decimalStringSchema,
  displayBalanceTry: decimalStringSchema,
  openingBalance: decimalStringSchema,
  availableCredit: decimalStringSchema.nullable(),
});

export const accountListSchema = itemListSchema(accountSchema);
export const deleteAccountResponseSchema = z.union([
  deletedEntitySchema,
  z.object({
    id: uuidSchema,
    isArchived: z.literal(true),
    version: versionSchema,
  }),
]);

export const categoryTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const categorySchema = z.object({
  id: uuidSchema,
  bookId: uuidSchema,
  parentId: uuidSchema.nullable(),
  name: z.string(),
  categoryType: categoryTypeSchema,
  icon: z.string().nullable(),
  sortOrder: z.number().int(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  version: versionSchema,
});

export const categoryListSchema = itemListSchema(categorySchema);
export const deleteCategoryResponseSchema = z.union([
  deletedEntitySchema,
  deactivatedEntitySchema,
]);

export const costCenterSchema = z.object({
  id: uuidSchema,
  bookId: uuidSchema,
  name: z.string(),
  description: z.string().nullable(),
  sortOrder: z.number().int(),
  isActive: z.boolean(),
  version: versionSchema,
});

export const costCenterListSchema = itemListSchema(costCenterSchema);
export const deleteCostCenterResponseSchema = z.union([
  deletedEntitySchema,
  deactivatedEntitySchema,
]);

export const transactionTypeSchema = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "SALE",
  "PURCHASE",
  "COLLECTION",
  "PAYMENT",
  "OPENING_BALANCE",
  "ADJUSTMENT",
  "REVERSAL",
]);

export const clientTransactionTypeSchema = transactionTypeSchema.exclude(["REVERSAL"]);

export const transactionListItemSchema = z.object({
  id: uuidSchema,
  transactionNo: z.string(),
  type: clientTransactionTypeSchema,
  accountId: uuidSchema.nullable(),
  accountName: z.string().nullable(),
  targetAccountId: uuidSchema.nullable(),
  targetAccountName: z.string().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  transactionDate: isoDateTimeSchema,
  dueDate: isoDateTimeSchema.nullable(),
  status: z.literal("POSTED"),
  currencyCode: currencyCodeSchema,
  categoryId: uuidSchema.nullable(),
  categoryName: z.string().nullable(),
  costCenterId: uuidSchema.nullable(),
  costCenterName: z.string().nullable(),
  contactId: uuidSchema.nullable(),
  version: versionSchema,
  amount: decimalStringSchema,
  balanceDelta: decimalStringSchema,
  runningBalance: decimalStringSchema,
});

export const transactionListSchema = z.object({
  items: z.array(transactionListItemSchema),
  openingBalance: decimalStringSchema,
  nextCursor: isoDateTimeSchema.nullable(),
});

export const transactionMutationResultSchema = z.object({
  id: uuidSchema,
  type: transactionTypeSchema,
  title: z.string(),
  status: z.enum(["DRAFT", "POSTED", "REVERSED", "CANCELLED"]),
  currencyCode: currencyCodeSchema,
  version: versionSchema,
  bookId: uuidSchema.optional(),
  transactionNo: z.string().optional(),
  accountId: uuidSchema.nullable().optional(),
  targetAccountId: uuidSchema.nullable().optional(),
  categoryId: uuidSchema.nullable().optional(),
  costCenterId: uuidSchema.nullable().optional(),
  contactId: uuidSchema.nullable().optional(),
  description: z.string().nullable().optional(),
  transactionDate: isoDateTimeSchema.optional(),
  dueDate: isoDateTimeSchema.nullable().optional(),
  clientOperationId: uuidSchema.optional(),
  createdAt: isoDateTimeSchema.optional(),
  amount: decimalStringSchema.optional(),
});

export const correctTransactionResponseSchema = z.object({
  reversal: transactionMutationResultSchema,
  transaction: transactionMutationResultSchema,
});

export const scheduledTransactionTypeSchema = z.enum([
  "INCOME",
  "EXPENSE",
  "TRANSFER",
  "SALE",
  "PURCHASE",
  "COLLECTION",
  "PAYMENT",
]);

export const scheduledStatusSchema = z.enum([
  "PENDING",
  "COMPLETED",
  "SKIPPED",
  "CANCELLED",
  "OVERDUE",
]);

export const scheduledTransactionSchema = z.object({
  id: uuidSchema,
  bookId: uuidSchema,
  accountId: uuidSchema,
  targetAccountId: uuidSchema.nullable(),
  transactionType: scheduledTransactionTypeSchema,
  categoryId: uuidSchema.nullable(),
  costCenterId: uuidSchema.nullable(),
  costCenterName: z.string().nullable(),
  contactId: uuidSchema.nullable(),
  title: z.string(),
  amount: decimalStringSchema,
  currencyCode: currencyCodeSchema,
  scheduledAt: isoDateTimeSchema,
  reminderAt: isoDateTimeSchema.nullable(),
  status: scheduledStatusSchema,
  seriesId: uuidSchema.nullable(),
  recurrenceFrequency: z.enum(["WEEKLY", "MONTHLY", "YEARLY"]).nullable(),
  recurrenceInterval: z.number().int().positive().nullable(),
  recurrenceEndAt: isoDateTimeSchema.nullable(),
  completedTransactionId: uuidSchema.nullable(),
  version: versionSchema,
});

const scheduledGroupsSchema = z.object({
  overdue: z.array(scheduledTransactionSchema),
  today: z.array(scheduledTransactionSchema),
  thisWeek: z.array(scheduledTransactionSchema),
  thisMonth: z.array(scheduledTransactionSchema),
  later: z.array(scheduledTransactionSchema),
});

export const scheduledTransactionListSchema = z.object({
  items: z.array(scheduledTransactionSchema),
  groups: scheduledGroupsSchema,
});

export const createScheduledTransactionResponseSchema = scheduledTransactionSchema.extend({
  createdCount: z.number().int().positive(),
});

export const setScheduledStatusResponseSchema = z.object({
  id: uuidSchema,
  status: z.enum(["SKIPPED", "CANCELLED"]),
  version: versionSchema,
});

const alreadyRealizedScheduledSchema = z.object({
  id: uuidSchema,
  status: z.literal("COMPLETED"),
  version: versionSchema,
  completedTransactionId: uuidSchema,
});

const newlyRealizedScheduledSchema = z.object({
  scheduled: scheduledTransactionSchema.extend({
    status: z.literal("COMPLETED"),
    completedTransactionId: uuidSchema,
  }),
  transaction: transactionMutationResultSchema,
});

export const realizeScheduledTransactionResponseSchema = z.union([
  alreadyRealizedScheduledSchema,
  newlyRealizedScheduledSchema,
]);

export const deleteScheduledTransactionResponseSchema = deletedEntitySchema;
