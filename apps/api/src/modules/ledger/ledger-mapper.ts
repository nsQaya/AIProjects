import { Money } from "@defterx/shared";
import { AppError } from "../../common/errors";
import type { LedgerEntryDraft, LedgerMappingInput } from "./ledger.types";

const entry = (accountId: string | undefined, direction: "DEBIT" | "CREDIT", input: LedgerMappingInput): LedgerEntryDraft => {
  if (!accountId) throw new AppError(422, "LEDGER_MAPPING_MISSING", `An account required for ${input.type} is missing`);
  return { accountId, direction, amount: input.amount, currencyCode: input.currencyCode, baseAmount: input.baseAmount ?? input.amount };
};

export function mapTransactionToEntries(input: LedgerMappingInput): LedgerEntryDraft[] {
  if (!Money.parse(input.amount).isPositive()) throw new AppError(422, "INVALID_AMOUNT", "Amount must be positive");
  switch (input.type) {
    case "INCOME": return [entry(input.accountId,"DEBIT",input),entry(input.categoryAccountId,"CREDIT",input)];
    case "EXPENSE": return [entry(input.categoryAccountId,"DEBIT",input),entry(input.accountId,"CREDIT",input)];
    case "TRANSFER": return [entry(input.targetAccountId,"DEBIT",input),entry(input.accountId,"CREDIT",input)];
    case "SALE": return [entry(input.contactAccountId,"DEBIT",input),entry(input.categoryAccountId,"CREDIT",input)];
    case "PURCHASE": return [entry(input.categoryAccountId,"DEBIT",input),entry(input.contactAccountId,"CREDIT",input)];
    case "COLLECTION": return [entry(input.accountId,"DEBIT",input),entry(input.contactAccountId,"CREDIT",input)];
    case "PAYMENT": return [entry(input.contactAccountId,"DEBIT",input),entry(input.accountId,"CREDIT",input)];
    case "OPENING_BALANCE": return [entry(input.accountId,"DEBIT",input),entry(input.equityAccountId,"CREDIT",input)];
    case "ADJUSTMENT": return [entry(input.accountId,"DEBIT",input),entry(input.targetAccountId,"CREDIT",input)];
    case "REVERSAL": throw new AppError(422,"USE_REVERSAL_ENDPOINT","Reversals must use the reversal endpoint");
  }
}

export function assertBalancedEntries(entries: LedgerEntryDraft[]): void {
  const debit = entries.filter((item) => item.direction === "DEBIT").reduce((sum,item) => sum.add(Money.parse(item.baseAmount)), Money.parse("0"));
  const credit = entries.filter((item) => item.direction === "CREDIT").reduce((sum,item) => sum.add(Money.parse(item.baseAmount)), Money.parse("0"));
  if (!debit.equals(credit)) throw new AppError(422,"UNBALANCED_TRANSACTION","Debit and credit totals must match");
}

export function reverseEntries(entries: LedgerEntryDraft[]): LedgerEntryDraft[] {
  return entries.map((item) => ({ ...item, direction: item.direction === "DEBIT" ? "CREDIT" : "DEBIT" }));
}

export function reconstructBalance(normalBalance: "DEBIT" | "CREDIT", entries: LedgerEntryDraft[]): string {
  const debit = entries.filter((item) => item.direction === "DEBIT").reduce((sum,item) => sum.add(Money.parse(item.baseAmount)), Money.parse("0"));
  const credit = entries.filter((item) => item.direction === "CREDIT").reduce((sum,item) => sum.add(Money.parse(item.baseAmount)), Money.parse("0"));
  return (normalBalance === "DEBIT" ? debit.subtract(credit) : credit.subtract(debit)).toString();
}
