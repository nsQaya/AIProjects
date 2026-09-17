import { z } from "zod";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(12).max(128),
});

export const onboardingPageKeys = ["transactions", "accounts", "savings", "upcoming", "reports", "settings"] as const;

export const completePageTourSchema = z.object({
  page: z.enum(onboardingPageKeys),
});
