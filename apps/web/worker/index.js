function javascriptConfig(env) {
  const config = JSON.stringify({
    appDisplayName: env.APP_DISPLAY_NAME || "DefterX",
    environment: env.APP_ENV || "production",
    apiBaseUrl: env.API_BASE_URL || ""
  }).replaceAll("<", "\\u003c");

  return `globalThis.__DEFTERX_CONFIG__ = ${config};`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok", service: "defterx-web", environment: env.APP_ENV || "production" });
    }

    if (url.pathname === "/config.js") {
      return new Response(javascriptConfig(env), {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff"
        }
      });
    }

    return env.ASSETS.fetch(request);
  }
};
