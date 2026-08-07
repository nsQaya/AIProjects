const runtime = globalThis.__DEFTERX_CONFIG__ || {};

export const Configuration = Object.freeze({
  displayName: runtime.appDisplayName || "DefterX",
  environment: runtime.environment || "development",
  apiBaseUrl: String(runtime.apiBaseUrl || "").replace(/\/$/, "")
});
