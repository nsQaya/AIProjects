import { describe, expect, it } from "vitest";

import { formatQuantity } from "./format";

describe("formatQuantity", () => {
  it("drops trailing-zero noise from NUMERIC(24,9) quantity strings", () => {
    expect(formatQuantity("21.000000000")).toBe("21");
    expect(formatQuantity("1196.000000000")).toBe("1196");
    expect(formatQuantity("694")).toBe("694");
  });

  it("keeps meaningful fractional digits and localizes the separator", () => {
    expect(formatQuantity("12.500000000")).toBe("12,5");
    expect(formatQuantity("2.2500")).toBe("2,25");
    expect(formatQuantity("0.123456789")).toBe("0,123456789");
  });

  it("is empty for nullish input", () => {
    expect(formatQuantity(null)).toBe("");
    expect(formatQuantity(undefined)).toBe("");
    expect(formatQuantity("")).toBe("");
  });
});
