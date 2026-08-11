/*
 * Development/static fallback. Cloudflare Worker intercepts `/config.js` in
 * production and returns environment-bound values with `no-store` caching.
 */
globalThis.__DEFTERX_CONFIG__ = globalThis.__DEFTERX_CONFIG__ || {
  appDisplayName: "DefterX",
  environment: "development",
  apiBaseUrl: "https://defterx-api.agentproje1.workers.dev"
};
