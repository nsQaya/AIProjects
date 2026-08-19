import { describe, expect, it } from "vitest";

import { createLotSchema, createSaleSchema } from "../../src/modules/investments/investment.schemas";

const ids = {
  book: "11111111-1111-4111-8111-111111111111",
  instrument: "22222222-2222-4222-8222-222222222222",
  account: "33333333-3333-4333-8333-333333333333",
  operation: "44444444-4444-4444-8444-444444444444",
};

describe("investment quantity precision", () => {
  it("accepts a fractional-share quantity down to 9 decimal places", () => {
    const parsed = createLotSchema.parse({
      bookId: ids.book,
      instrumentId: ids.instrument,
      quantity: "0.123456789",
      unitPrice: "150.25",
      purchasedAt: "2026-08-19T00:00:00.000Z",
    });
    expect(parsed.quantity).toBe("0.123456789");
  });

  it("rejects a 10th decimal place, past what the NUMERIC(24,9) column can store", () => {
    expect(() => createLotSchema.parse({
      bookId: ids.book,
      instrumentId: ids.instrument,
      quantity: "0.1234567891",
      unitPrice: "150.25",
      purchasedAt: "2026-08-19T00:00:00.000Z",
    })).toThrow();
  });

  it("applies the same 9-decimal precision to sale quantities", () => {
    const parsed = createSaleSchema.parse({
      bookId: ids.book,
      instrumentId: ids.instrument,
      destinationAccountId: ids.account,
      quantity: "2.5",
      unitPrice: "150.25",
      soldAt: "2026-08-19T00:00:00.000Z",
      clientOperationId: ids.operation,
    });
    expect(parsed.quantity).toBe("2.5");
  });

  it("still rejects a zero or negative quantity", () => {
    expect(() => createLotSchema.parse({
      bookId: ids.book,
      instrumentId: ids.instrument,
      quantity: "0",
      unitPrice: "150.25",
      purchasedAt: "2026-08-19T00:00:00.000Z",
    })).toThrow();
  });
});
