import { describe, expect, it } from "vitest";
import { computeInstallmentDueDates } from "../../src/modules/scheduled-transactions/installment-schedule";

function isoDays(dates: Date[]): string[] {
  return dates.map((date) => date.toISOString().slice(0, 10));
}

describe("computeInstallmentDueDates", () => {
  it("closes in the same month when the purchase is on or before the statement day", () => {
    const dates = computeInstallmentDueDates(new Date("2026-03-05T12:00:00.000Z"), 10, 10, 3);
    expect(isoDays(dates)).toEqual(["2026-03-20", "2026-04-20", "2026-05-20"]);
  });

  it("rolls to next month's statement when the purchase is after the statement day", () => {
    const dates = computeInstallmentDueDates(new Date("2026-03-15T12:00:00.000Z"), 10, 10, 1);
    expect(isoDays(dates)).toEqual(["2026-04-20"]);
  });

  it("rolls the closing day over into the next month when the due offset crosses a month boundary", () => {
    const dates = computeInstallmentDueDates(new Date("2026-01-05T12:00:00.000Z"), 28, 10, 1);
    expect(isoDays(dates)).toEqual(["2026-02-07"]);
  });

  it("carries a December purchase into the next calendar year", () => {
    const dates = computeInstallmentDueDates(new Date("2026-12-15T12:00:00.000Z"), 10, 5, 2);
    expect(isoDays(dates)).toEqual(["2027-01-15", "2027-02-15"]);
  });

  it("falls exactly on the statement day when the due offset is zero", () => {
    const dates = computeInstallmentDueDates(new Date("2026-06-01T12:00:00.000Z"), 15, 0, 1);
    expect(isoDays(dates)).toEqual(["2026-06-15"]);
  });
});
