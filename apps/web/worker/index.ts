interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Environment {
  APP_DISPLAY_NAME?: string;
  APP_ENV?: string;
  API_BASE_URL?: string;
  ASSETS: AssetsBinding;
}

function javascriptConfig(environment: Environment): string {
  const config = JSON.stringify({
    appDisplayName: environment.APP_DISPLAY_NAME || "DefterX",
    environment: environment.APP_ENV || "production",
    apiBaseUrl: environment.API_BASE_URL || "",
  }).replaceAll("<", "\\u003c");

  return `globalThis.__DEFTERX_CONFIG__ = ${config};`;
}

export default {
  async fetch(request: Request, environment: Environment): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({
        status: "ok",
        service: "defterx-web",
        environment: environment.APP_ENV || "production",
      });
    }

    if (url.pathname === "/config.js") {
      return new Response(javascriptConfig(environment), {
        headers: {
          "content-type": "text/javascript; charset=utf-8",
          "cache-control": "no-store",
          "x-content-type-options": "nosniff",
        },
      });
    }

    return environment.ASSETS.fetch(request);
  },
};
