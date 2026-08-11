import type { ZodType } from "zod";
import {
  loginResponseSchema,
  refreshResponseSchema,
  registerResponseSchema,
  type AuthSession,
  type LoginInput,
  type LoginResponse,
  type RefreshResponse,
  type RegisterInput,
  type RegisterResponse,
} from "../auth/auth-schemas";
import type { SessionPersistence } from "../auth/session-store";
import { APIError, apiErrorFromResponse } from "./api-error";

export type HTTPMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface RequestOptions<TResponse> {
  method?: HTTPMethod;
  body?: unknown;
  headers?: HeadersInit;
  auth?: boolean;
  idempotencyKey?: string;
  schema?: ZodType<TResponse>;
}

interface InternalRequestOptions<TResponse> extends RequestOptions<TResponse> {
  retryUnauthorized?: boolean;
  serverRetryCount?: number;
}

export interface APIClientDependencies {
  fetch?: typeof globalThis.fetch;
  sleep?: (milliseconds: number) => Promise<void>;
}

export interface HealthStatus {
  online: boolean;
  mode: "api" | "offline" | "unconfigured";
  reason: string;
  data?: unknown;
}

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

async function readJson(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  return response.json().catch(() => null) as Promise<unknown>;
}

export class APIClient {
  readonly #baseUrl: string;
  readonly #sessionStore: SessionPersistence;
  readonly #fetch: typeof globalThis.fetch;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  #session: AuthSession | null;
  #refreshPromise: Promise<void> | null = null;

  constructor(
    baseUrl: string,
    sessionStore: SessionPersistence,
    dependencies: APIClientDependencies = {},
  ) {
    this.#baseUrl = normalizeBaseUrl(baseUrl);
    this.#sessionStore = sessionStore;
    this.#fetch = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
    this.#sleep = dependencies.sleep ?? defaultSleep;
    this.#session = sessionStore.load();
  }

  get session(): AuthSession | null {
    return this.#session;
  }

  hasSession(): boolean {
    return Boolean(this.#session?.accessToken || this.#session?.refreshToken);
  }

  setSession(value: AuthSession | null): void {
    this.#session = value;
    if (value) this.#sessionStore.save(value);
    else this.#sessionStore.clear();
  }

  async health(): Promise<HealthStatus> {
    if (!this.#baseUrl) {
      return {
        online: false,
        mode: "unconfigured",
        reason: "API adresi tanımlı değil",
      };
    }

    try {
      const response = await this.#fetch(`${this.#baseUrl}/health/ready`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const data = await readJson(response);
      const status =
        typeof data === "object" && data !== null && "status" in data
          ? String(data.status)
          : `HTTP ${response.status}`;

      return {
        online: response.ok,
        mode: "api",
        reason: response.ok ? "Canlı API ve veritabanı bağlı" : status,
        data,
      };
    } catch (error) {
      return {
        online: false,
        mode: "offline",
        reason: error instanceof Error ? error.message : "Bağlantı kurulamadı",
      };
    }
  }

  async register(payload: RegisterInput): Promise<RegisterResponse> {
    const data = await this.request("/api/v1/auth/register", {
      method: "POST",
      body: payload,
      auth: false,
      schema: registerResponseSchema,
    });
    this.setSession(data);
    return data;
  }

  async login(payload: LoginInput): Promise<LoginResponse> {
    const data = await this.request("/api/v1/auth/login", {
      method: "POST",
      body: payload,
      auth: false,
      schema: loginResponseSchema,
    });
    this.setSession(data);
    return data;
  }

  async logout(): Promise<void> {
    const refreshToken = this.#session?.refreshToken;
    try {
      if (refreshToken) {
        await this.request<null>("/api/v1/auth/logout", {
          method: "POST",
          body: { refreshToken },
          auth: false,
        });
      }
    } finally {
      this.setSession(null);
    }
  }

  request<TResponse = unknown>(
    path: string,
    options: RequestOptions<TResponse> = {},
  ): Promise<TResponse> {
    return this.#request(path, options);
  }

  async refresh(): Promise<void> {
    if (this.#refreshPromise) return this.#refreshPromise;

    this.#refreshPromise = (async () => {
      try {
        const current = this.#session;
        if (!current?.refreshToken) {
          throw new APIError(401, "REFRESH_TOKEN_MISSING", "Oturum yenileme anahtarı bulunamadı");
        }

        const data: RefreshResponse = await this.#request("/api/v1/auth/refresh", {
          method: "POST",
          body: { refreshToken: current.refreshToken },
          auth: false,
          retryUnauthorized: false,
          schema: refreshResponseSchema,
        });
        this.setSession({ ...current, ...data });
      } catch (error) {
        this.setSession(null);
        throw error;
      } finally {
        this.#refreshPromise = null;
      }
    })();

    return this.#refreshPromise;
  }

  async #request<TResponse>(
    path: string,
    {
      method = "GET",
      body,
      headers,
      auth = true,
      idempotencyKey,
      schema,
      retryUnauthorized = true,
      serverRetryCount = 0,
    }: InternalRequestOptions<TResponse>,
  ): Promise<TResponse> {
    if (!this.#baseUrl) {
      throw new APIError(0, "API_NOT_CONFIGURED", "Canlı API adresi tanımlı değil");
    }

    const requestHeaders = new Headers(headers);
    requestHeaders.set("Accept", "application/json");
    if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
    if (idempotencyKey) requestHeaders.set("Idempotency-Key", idempotencyKey);
    if (auth && this.#session?.accessToken) {
      requestHeaders.set("Authorization", `Bearer ${this.#session.accessToken}`);
    }

    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}${path}`, {
        method,
        headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        cache: "no-store",
      });
    } catch (error) {
      throw new APIError(
        0,
        "NETWORK_ERROR",
        error instanceof Error ? error.message : "Ağa erişilemedi",
        { cause: error },
      );
    }

    if (
      response.status === 401 &&
      auth &&
      retryUnauthorized &&
      this.#session?.refreshToken
    ) {
      await this.refresh();
      return this.#request(path, {
        method,
        body,
        headers,
        auth,
        idempotencyKey,
        schema,
        retryUnauthorized: false,
        serverRetryCount,
      });
    }

    if (response.status >= 500 && method === "GET" && serverRetryCount < 2) {
      await this.#sleep(300 * (serverRetryCount + 1));
      return this.#request(path, {
        method,
        body,
        headers,
        auth,
        idempotencyKey,
        schema,
        retryUnauthorized,
        serverRetryCount: serverRetryCount + 1,
      });
    }

    const data = await readJson(response);
    if (!response.ok) throw apiErrorFromResponse(response.status, data);

    if (!schema) return data as TResponse;

    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      throw new APIError(502, "INVALID_API_RESPONSE", "API yanıtı beklenen biçimde değil", {
        details: parsed.error.issues,
      });
    }
    return parsed.data;
  }
}
