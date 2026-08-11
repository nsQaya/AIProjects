import { z } from "zod";

const runtimeConfigSourceSchema = z
  .object({
    appDisplayName: z.string().trim().min(1).optional(),
    environment: z.string().trim().min(1).optional(),
    apiBaseUrl: z.string().optional(),
  })
  .passthrough();

export interface RuntimeConfig {
  readonly displayName: string;
  readonly environment: string;
  readonly apiBaseUrl: string;
}

type RuntimeGlobal = typeof globalThis & {
  __DEFTERX_CONFIG__?: unknown;
};

function normalizeApiBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function readRuntimeConfig(
  source: Pick<RuntimeGlobal, "__DEFTERX_CONFIG__"> = globalThis as RuntimeGlobal,
): RuntimeConfig {
  const parsed = runtimeConfigSourceSchema.safeParse(source.__DEFTERX_CONFIG__ ?? {});
  const runtime = parsed.success ? parsed.data : {};

  return Object.freeze({
    displayName: runtime.appDisplayName ?? "DefterX",
    environment: runtime.environment ?? "development",
    apiBaseUrl: normalizeApiBaseUrl(runtime.apiBaseUrl ?? ""),
  });
}

/**
 * Loaded after the blocking `/config.js` script in `index.html`.
 * Keeping this export name makes the React shell easy to wire without changing
 * the Cloudflare runtime configuration contract.
 */
export const Configuration = readRuntimeConfig();
