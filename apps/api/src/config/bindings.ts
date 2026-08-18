import type pg from "pg";

export interface RateLimiterBinding {
  limit(input: { key: string }): Promise<{ success: boolean }>;
}

export interface PasswordResetMail {
  recipientEmail: string;
  displayName: string;
  token: string;
  expiresAt: string;
}

export interface PasswordResetMailer {
  sendPasswordResetEmail(message: PasswordResetMail): Promise<void>;
}

export interface EmailBinding {
  send(message: {
    to: string;
    from: string | { email: string; name?: string };
    subject: string;
    html: string;
    text: string;
  }): Promise<unknown>;
}

export interface Env {
  HYPERDRIVE: Hyperdrive;
  JWT_SECRET: string;
  REFRESH_TOKEN_PEPPER: string;
  PASSWORD_RESET_TOKEN_PEPPER: string;
  PASSWORD_RESET_FROM_EMAIL: string;
  WEB_APP_URL: string;
  EMAIL?: EmailBinding;
  APP_DISPLAY_NAME: string;
  ALLOWED_ORIGINS: string;
  ACCESS_TOKEN_TTL_SECONDS: string;
  REFRESH_TOKEN_TTL_SECONDS: string;
  JOBS: Queue<BackgroundJob>;
  RATE_LIMITER: RateLimiterBinding;
}

export type BackgroundJob =
  | { type: "PROCESS_RECURRING"; recurringId?: string }
  | { type: "SEND_REMINDER"; scheduledTransactionId: string }
  | { type: "SYNC_MARKET_CATALOG" }
  | { type: "ENSURE_MARKET_DATA"; targetDate: string }
  | { type: "PLAN_MARKET_PRICES"; runId: string; targetDate: string }
  | {
      type: "FETCH_MARKET_PRICE_BATCH";
      runId: string;
      targetDate: string;
      batchKey: string;
      items: Array<{ id: string; symbol: string }>;
    }
  | { type: "PLAN_MARKET_SPLITS" }
  | { type: "FETCH_MARKET_SPLIT_BATCH"; items: Array<{ id: string; symbol: string }> }
  | { type: "SYNC_CURRENCY_RATES"; targetDate: string };

export interface AuthUser { id: string; email: string }

export interface AppVariables {
  requestId: string;
  user: AuthUser;
  database: pg.Client;
}

export type AppEnv = { Bindings: Env; Variables: AppVariables };
