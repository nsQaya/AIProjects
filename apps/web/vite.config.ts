import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

const DEFAULT_API_URL = "https://defterx-api.agentproje1.workers.dev";

function runtimeConfigPlugin(apiBaseUrl: string): Plugin {
  return {
    name: "defterx-runtime-config",
    configureServer(server) {
      server.middlewares.use("/config.js", (_request, response) => {
        const config = JSON.stringify({
          appDisplayName: "DefterX",
          environment: "development",
          apiBaseUrl,
        }).replaceAll("<", "\\u003c");

        response.statusCode = 200;
        response.setHeader("Content-Type", "text/javascript; charset=utf-8");
        response.setHeader("Cache-Control", "no-store");
        response.end(`globalThis.__DEFTERX_CONFIG__ = ${config};`);
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, ".", "");
  const apiBaseUrl = environment.DEFTERX_API_BASE_URL || DEFAULT_API_URL;

  return {
    plugins: [react(), runtimeConfigPlugin(apiBaseUrl)],
    build: {
      outDir: "dist",
      emptyOutDir: true,
      sourcemap: true,
    },
    server: {
      host: "127.0.0.1",
      port: 3000,
    },
    preview: {
      host: "127.0.0.1",
      port: 4173,
    },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test/setup.ts"],
      globals: true,
      css: true,
      coverage: {
        reporter: ["text", "html"],
      },
    },
  };
});
