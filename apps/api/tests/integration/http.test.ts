import { describe, expect, it } from "vitest";
import { app } from "../../src/app";

describe("HTTP shell", () => {
  it("serves health without exposing internals", async () => {
    const response = await app.request("/health", {}, {} as never);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("allows the configured web origin to read health", async () => {
    const webOrigin = "https://web.example.test";
    const response = await app.request("/health", { headers: { Origin: webOrigin } }, { ALLOWED_ORIGINS: webOrigin } as never);
    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(webOrigin);
  });

  it("serves the OpenAPI contract", async () => {
    const response = await app.request("/api/v1/openapi.yaml", {}, { ALLOWED_ORIGINS: "" } as never);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("/transactions:");
  });
});
