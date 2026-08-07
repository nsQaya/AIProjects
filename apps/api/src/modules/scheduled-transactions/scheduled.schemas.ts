import { z } from "zod";
import { currency, isoDate, money, uuid } from "../../common/schemas";

const transactionType = z.enum(["INCOME","EXPENSE","TRANSFER","SALE","PURCHASE","COLLECTION","PAYMENT"]);
const recurrenceFrequency = z.enum(["WEEKLY","MONTHLY","YEARLY"]);

export const createScheduledSchema = z.object({
  bookId: uuid,
  accountId: uuid,
  targetAccountId: uuid.nullable().optional(),
  transactionType,
  categoryId: uuid.nullable().optional(),
  contactId: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(200),
  amount: money,
  currencyCode: currency,
  scheduledAt: isoDate,
  reminderAt: isoDate.nullable().optional(),
  recurrence: z.object({
    frequency: recurrenceFrequency,
    interval: z.number().int().positive().max(12).default(1),
    until: isoDate
  }).optional()
}).superRefine((value,context)=>{
  if(value.transactionType==="TRANSFER"&&!value.targetAccountId)context.addIssue({code:"custom",path:["targetAccountId"],message:"Transfer target account is required"});
  if(value.recurrence&&new Date(value.recurrence.until)<new Date(value.scheduledAt))context.addIssue({code:"custom",path:["recurrence","until"],message:"Recurrence end must be on or after the first date"});
});

export const updateScheduledSchema = z.object({
  accountId: uuid.optional(),
  targetAccountId: uuid.nullable().optional(),
  transactionType: transactionType.optional(),
  categoryId: uuid.nullable().optional(),
  contactId: uuid.nullable().optional(),
  title: z.string().trim().min(1).max(200).optional(),
  amount: money.optional(),
  scheduledAt: isoDate.optional(),
  reminderAt: isoDate.nullable().optional(),
  version: z.number().int().positive()
});

export const scheduledStatusSchema = z.object({
  status: z.enum(["SKIPPED","CANCELLED"]),
  version: z.number().int().positive()
});

export const realizeScheduledSchema = z.object({
  version: z.number().int().positive(),
  transactionDate: isoDate.optional(),
  clientOperationId: uuid
});

export type CreateScheduledInput = z.infer<typeof createScheduledSchema>;
export type UpdateScheduledInput = z.infer<typeof updateScheduledSchema>;
