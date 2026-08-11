import { z } from "zod";

export const authUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email(),
    displayName: z.string(),
  })
  .passthrough();

export const authTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().nonnegative(),
});

export const loginResponseSchema = authTokensSchema
  .extend({
    user: authUserSchema,
  })
  .passthrough();

export const registerResponseSchema = loginResponseSchema
  .extend({
    book: z.unknown(),
  })
  .passthrough();

export const refreshResponseSchema = authTokensSchema.passthrough();

export const authSessionSchema = loginResponseSchema
  .extend({
    book: z.unknown().optional(),
  })
  .passthrough();

export type AuthUser = z.infer<typeof authUserSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
export type LoginResponse = z.infer<typeof loginResponseSchema>;
export type RegisterResponse = z.infer<typeof registerResponseSchema>;
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;
export type AuthSession = z.infer<typeof authSessionSchema>;

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput extends LoginInput {
  displayName: string;
}
