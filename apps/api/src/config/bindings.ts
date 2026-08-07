import type pg from "pg";

export interface RateLimiterBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  HYPERDRIVE: Hyperdrive;
  JWT_SECRET: string;
  REFRESH_TOKEN_PEPPER: string;
  APP_DISPLAY_NAME: string;
  ALLOWED_ORIGINS: string;
  ACCESS_TOKEN_TTL_SECONDS: string;
  REFRESH_TOKEN_TTL_SECONDS: string;
  JOBS: Queue<BackgroundJob>;
  RATE_LIMITER: RateLimiterBinding;
}

export type BackgroundJob =
  | { type: "PROCESS_RECURRING"; recurringId?: string }
  | { type: "SEND_REMINDER"; scheduledTransactionId: string };

export interface AuthUser { id: string; email: string }

export interface AppVariables {
  requestId: string;
  user: AuthUser;
  database: pg.Client;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };
