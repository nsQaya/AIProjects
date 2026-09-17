import { describe, expect, it } from "vitest";

import { completePageTourSchema } from "../../src/modules/users/user.schemas";

describe("completePageTourSchema", () => {
  it("accepts every known onboarding page key", () => {
    for (const page of ["transactions", "accounts", "savings", "upcoming", "reports", "settings"]) {
      expect(completePageTourSchema.safeParse({ page }).success).toBe(true);
    }
  });

  it("rejects an unknown page key", () => {
    expect(completePageTourSchema.safeParse({ page: "dashboard" }).success).toBe(false);
    expect(completePageTourSchema.safeParse({ page: "not-a-page" }).success).toBe(false);
    expect(completePageTourSchema.safeParse({}).success).toBe(false);
  });
});
