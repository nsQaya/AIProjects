import { describe,expect,it } from "vitest";

import {
  createCostCenterSchema,
  updateCostCenterSchema,
} from "../../src/modules/cost-centers/cost-center.schemas";
import {
  createScheduledSchema,
  updateScheduledSchema,
} from "../../src/modules/scheduled-transactions/scheduled.schemas";
import { transactionMutationSchema } from "../../src/modules/transactions/transaction.schemas";

const ids = {
  book: "11111111-1111-4111-8111-111111111111",
  account: "22222222-2222-4222-8222-222222222222",
  category: "33333333-3333-4333-8333-333333333333",
  costCenter: "44444444-4444-4444-8444-444444444444",
  operation: "55555555-5555-4555-8555-555555555555",
};

describe("cost-center schemas",()=>{
  it("normalizes create values and applies a stable sort default",()=>{
    expect(createCostCenterSchema.parse({
      bookId:ids.book,
      name:"  Araba  ",
      description:"  Yakıt ve bakım  ",
    })).toEqual({
      bookId:ids.book,
      name:"Araba",
      description:"Yakıt ve bakım",
      sortOrder:0,
    });
  });

  it("supports activation and nullable description with optimistic versioning",()=>{
    expect(updateCostCenterSchema.parse({
      description:null,
      isActive:true,
      version:2,
    })).toEqual({description:null,isActive:true,version:2});
    expect(updateCostCenterSchema.safeParse({name:" ",version:2}).success).toBe(false);
  });

  it("accepts costCenterId on transaction and scheduled create/update payloads",()=>{
    const transaction = transactionMutationSchema.parse({
      bookId:ids.book,
      type:"EXPENSE",
      title:"Yakıt",
      amount:"500",
      currencyCode:"TRY",
      accountId:ids.account,
      categoryId:ids.category,
      costCenterId:ids.costCenter,
      transactionDate:"2026-08-11T12:00:00.000Z",
      clientOperationId:ids.operation,
    });
    expect(transaction.costCenterId).toBe(ids.costCenter);

    const scheduled = createScheduledSchema.parse({
      bookId:ids.book,
      accountId:ids.account,
      transactionType:"EXPENSE",
      categoryId:ids.category,
      costCenterId:ids.costCenter,
      title:"Bakım",
      amount:"250",
      currencyCode:"TRY",
      scheduledAt:"2026-09-01T12:00:00.000Z",
    });
    expect(scheduled.costCenterId).toBe(ids.costCenter);
    expect(updateScheduledSchema.parse({costCenterId:null,version:3})).toEqual({
      costCenterId:null,
      version:3,
    });
  });

  it("rejects malformed cost-center identifiers on financial mutations",()=>{
    const result = transactionMutationSchema.safeParse({
      bookId:ids.book,
      type:"EXPENSE",
      title:"Yakıt",
      amount:"500",
      currencyCode:"TRY",
      accountId:ids.account,
      costCenterId:"not-a-uuid",
      transactionDate:"2026-08-11T12:00:00.000Z",
      clientOperationId:ids.operation,
    });
    expect(result.success).toBe(false);
  });
});
