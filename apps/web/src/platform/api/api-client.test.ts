import { describe, expect, it, vi } from "vitest";
import type { AuthSession } from "../auth/auth-schemas";
import type { SessionPersistence } from "../auth/session-store";
import { APIClient } from "./api-client";

const initialSession: AuthSession = {
  user: {
    id: "user-1",
    email: "user@example.com",
    displayName: "Test User",
  },
  accessToken: "old-access-token",
  refreshToken: "old-refresh-token",
  expiresIn: 900,
};

function createSessionStore(session: AuthSession | null = initialSession): {
  store: SessionPersistence;
  save: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
} {
  const save = vi.fn();
  const clear = vi.fn();
  return {
    store: {
      load: () => session,
      save,
      clear,
    },
    save,
    clear,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("APIClient auth lifecycle", () => {
  it("shares one refresh request across simultaneous 401 responses", async () => {
    let resolveRefresh!: (response: Response) => void;
    const refreshResponse = new Promise<Response>((resolve) => {
      resolveRefresh = resolve;
    });
    let refreshCalls = 0;

    const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      const authorization = new Headers(init?.headers).get("Authorization");

      if (url.endsWith("/api/v1/auth/refresh")) {
        refreshCalls += 1;
        return refreshResponse;
      }
      if (authorization === "Bearer old-access-token") {
        return jsonResponse({ error: { code: "TOKEN_EXPIRED", message: "Expired" } }, 401);
      }
      return jsonResponse({ path: new URL(url).pathname });
    });

    const { store, save } = createSessionStore();
    const client = new APIClient("https://api.example.test", store, { fetch: fetchMock });
    const first = client.request<{ path: string }>("/first");
    const second = client.request<{ path: string }>("/second");

    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    resolveRefresh(
      jsonResponse({
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
        expiresIn: 900,
      }),
    );

    await expect(Promise.all([first, second])).resolves.toEqual([
      { path: "/first" },
      { path: "/second" },
    ]);
    expect(refreshCalls).toBe(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(client.session?.accessToken).toBe("new-access-token");
  });

  it("clears local session even when remote logout fails", async () => {
    const { store, clear } = createSessionStore();
    const fetchMock = vi.fn<typeof fetch>().mockRejectedValue(new Error("network down"));
    const client = new APIClient("https://api.example.test", store, { fetch: fetchMock });

    await expect(client.logout()).rejects.toMatchObject({ code: "NETWORK_ERROR" });

    expect(clear).toHaveBeenCalledTimes(1);
    expect(client.session).toBeNull();
    expect(client.hasSession()).toBe(false);
  });
});
