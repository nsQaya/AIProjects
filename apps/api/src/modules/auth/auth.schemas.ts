import { z } from "zod";

export const registerSchema = z.object({
  email: z.email().max(254).transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
  displayName: z.string().trim().min(1).max(120),
});
export const loginSchema = z.object({ email: z.email().transform((value) => value.toLowerCase()), password: z.string().min(1).max(128) });
export const refreshSchema = z.object({ refreshToken: z.string().min(32).max(512) });

