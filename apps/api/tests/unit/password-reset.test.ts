import { describe, expect, it, vi } from "vitest";

import type { EmailBinding, Env, PasswordResetMailer } from "../../src/config/bindings";
import type { DbClient } from "../../src/infrastructure/database";
import {
  changePassword,
  hashPasswordResetToken,
  requestPasswordReset,
  resetPassword,
} from "../../src/modules/auth/auth.service";
import { createPasswordResetMailer } from "../../src/modules/auth/password-reset-mailer";

const env = {
  JWT_SECRET: "jwt-secret-that-is-long-enough-for-tests",
  REFRESH_TOKEN_PEPPER: "refresh-pepper-that-is-long-enough-for-tests",
  PASSWORD_RESET_TOKEN_PEPPER: "password-reset-pepper-long-enough-for-tests",
  PASSWORD_RESET_FROM_EMAIL: "security@example.test",
  WEB_APP_URL: "https://web.example.test",
  APP_DISPLAY_NAME: "DefterX",
  ACCESS_TOKEN_TTL_SECONDS: "900",
  REFRESH_TOKEN_TTL_SECONDS: "2592000",
} as Env;

function mockDatabase(handler: (statement: string, parameters?: unknown[]) => unknown): {
  client: DbClient;
  query: ReturnType<typeof vi.fn>;
} {
  const query = vi.fn(async (statement: string, parameters?: unknown[]) => {
    const result = handler(statement, parameters);
    return result ?? { rows: [], rowCount: 0 };
  });
  return { client: { query } as unknown as DbClient, query };
}

describe("password reset security", () => {
  it("domain-separates reset token hashes with a required pepper", async () => {
    const first = await hashPasswordResetToken("raw-token", env.PASSWORD_RESET_TOKEN_PEPPER);
    const second = await hashPasswordResetToken("raw-token", env.PASSWORD_RESET_TOKEN_PEPPER);
    expect(first).toBe(second);
    expect(first).not.toContain("raw-token");
    await expect(hashPasswordResetToken("raw-token", "short")).rejects.toThrow(/32 bytes/);
  });

  it("returns an availability error before querying when no mailer is configured", async () => {
    const { client, query } = mockDatabase(() => undefined);
    await expect(requestPasswordReset(client, env, { email: "person@example.test" }, undefined))
      .rejects.toMatchObject({ status: 503, code: "PASSWORD_RESET_EMAIL_UNAVAILABLE" });
    expect(query).not.toHaveBeenCalled();
  });

  it("does not disclose an unknown email to a configured mailer", async () => {
    const { client, query } = mockDatabase((statement) => {
      if (statement.includes("FROM users")) return { rows: [], rowCount: 0 };
      return undefined;
    });
    const mailer: PasswordResetMailer = { sendPasswordResetEmail: vi.fn() };
    await expect(requestPasswordReset(client, env, { email: "unknown@example.test" }, mailer)).resolves.toBeUndefined();
    expect(mailer.sendPasswordResetEmail).not.toHaveBeenCalled();
    expect(query.mock.calls.map(([statement]) => statement)).toEqual(expect.arrayContaining(["BEGIN", "COMMIT"]));
  });

  it("rolls back the reset token when email delivery fails and never stores the raw token", async () => {
    const { client, query } = mockDatabase((statement) => {
      if (statement.includes("FROM users")) {
        return { rows: [{ id: "user-1", email: "person@example.test", display_name: "Person" }], rowCount: 1 };
      }
      if (statement.includes("INSERT INTO password_reset_tokens")) {
        return { rows: [{ expires_at: new Date(Date.now() + 1_800_000) }], rowCount: 1 };
      }
      return undefined;
    });
    let deliveredToken = "";
    const mailer: PasswordResetMailer = {
      sendPasswordResetEmail: vi.fn(async (message) => {
        deliveredToken = message.token;
        throw new Error("provider unavailable");
      }),
    };

    await expect(requestPasswordReset(client, env, { email: "person@example.test" }, mailer))
      .rejects.toMatchObject({ status: 503, code: "PASSWORD_RESET_EMAIL_UNAVAILABLE" });
    expect(deliveredToken.length).toBeGreaterThan(32);
    const insert = query.mock.calls.find(([statement]) => String(statement).includes("INSERT INTO password_reset_tokens"));
    expect(insert).toBeDefined();
    expect(insert![1]).not.toContain(deliveredToken);
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("uses one generic error for invalid and expired reset tokens", async () => {
    const { client } = mockDatabase((statement) => {
      if (statement.includes("FROM password_reset_tokens")) return { rows: [], rowCount: 0 };
      return undefined;
    });
    await expect(resetPassword(client, env, { token: "invalid", newPassword: "new-password-value" }))
      .rejects.toMatchObject({ status: 400, code: "INVALID_PASSWORD_RESET_TOKEN" });
  });

  it("consumes every reset token and revokes sessions after a successful reset", async () => {
    const { client, query } = mockDatabase((statement) => {
      if (statement.includes("FROM password_reset_tokens")) {
        return {
          rows: [{ id: "reset-1", user_id: "user-1", email: "person@example.test", new_password_matches: false }],
          rowCount: 1,
        };
      }
      if (statement.includes("SELECT crypt")) return { rows: [{ password_hash: "next-hash" }], rowCount: 1 };
      return undefined;
    });

    await expect(resetPassword(client, env, { token: "one-time-token", newPassword: "new-password-value" }))
      .resolves.toBeUndefined();
    expect(query.mock.calls.some(([statement]) => String(statement).includes("UPDATE auth_credentials"))).toBe(true);
    expect(query.mock.calls.some(([statement]) => String(statement).includes("UPDATE password_reset_tokens SET used_at"))).toBe(true);
    expect(query.mock.calls.some(([statement]) => String(statement).includes("UPDATE refresh_tokens SET revoked_at"))).toBe(true);
    const lookup = query.mock.calls.find(([statement]) => String(statement).includes("FROM password_reset_tokens"));
    expect(lookup?.[1]?.[0]).not.toBe("one-time-token");
    expect(query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("rejects reusing the existing password", async () => {
    const { client, query } = mockDatabase((statement) => {
      if (statement.includes("FROM password_reset_tokens")) {
        return {
          rows: [{ id: "reset-1", user_id: "user-1", email: "person@example.test", new_password_matches: true }],
          rowCount: 1,
        };
      }
      return undefined;
    });
    await expect(resetPassword(client, env, { token: "one-time-token", newPassword: "same-password-value" }))
      .rejects.toMatchObject({ status: 422, code: "PASSWORD_UNCHANGED" });
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  });

  it("changes the password, returns fresh tokens and revokes every other refresh token", async () => {
    const { client, query } = mockDatabase((statement) => {
      if (statement.includes("FROM users u") && statement.includes("current_password_matches")) {
        return { rows: [{ id: "user-1", email: "person@example.test", current_password_matches: true, new_password_matches: false }], rowCount: 1 };
      }
      if (statement.includes("SELECT crypt")) return { rows: [{ password_hash: "safe-hash" }], rowCount: 1 };
      if (statement.includes("INSERT INTO refresh_tokens")) return { rows: [{ id: "new-refresh-id" }], rowCount: 1 };
      return undefined;
    });

    const tokens = await changePassword(client, env, "user-1", {
      currentPassword: "old-password-value",
      newPassword: "new-password-value",
    });
    expect(tokens).toMatchObject({ expiresIn: 900 });
    expect(tokens.accessToken).toContain(".");
    expect(tokens.refreshToken.length).toBeGreaterThan(32);
    const revoke = query.mock.calls.find(([statement]) => String(statement).includes("id<>$2"));
    expect(revoke?.[1]).toEqual(["user-1", "new-refresh-id"]);
    expect(query).toHaveBeenLastCalledWith("COMMIT");
  });

  it("builds an encoded reset link and escapes user-controlled HTML", async () => {
    const messages: Array<Parameters<EmailBinding["send"]>[0]> = [];
    const send = vi.fn(async (message: Parameters<EmailBinding["send"]>[0]) => {
      messages.push(message);
    });
    const mailer = createPasswordResetMailer({ ...env, EMAIL: { send } });
    await mailer!.sendPasswordResetEmail({
      recipientEmail: "person@example.test",
      displayName: "<Person>",
      token: "a token&value",
      expiresAt: new Date().toISOString(),
    });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({
      to: "person@example.test",
      html: expect.stringContaining("&lt;Person&gt;"),
      text: expect.stringContaining("a%20token%26value"),
    }));
    expect(messages[0]!.html).toContain("a%20token%26value");
  });
});
