import { AppError } from "../../common/errors";
import { randomToken, sha256, signAccessToken } from "../../common/crypto";
import { inTransaction } from "../../infrastructure/database";
import type { Env } from "../../config/bindings";
import type { PasswordResetMailer } from "../../config/bindings";
import type { DbClient } from "../../infrastructure/database";
import { createBookWithClient } from "../books/book.service";

interface UserRow { id: string; email: string; display_name: string }
interface RefreshRow { id: string; user_id: string; family_id: string; revoked_at: Date | null; expires_at: Date; email: string }
interface PasswordResetRow { id: string; user_id: string; email: string; new_password_matches: boolean }
interface PasswordCredentialRow { id: string; email: string; current_password_matches: boolean; new_password_matches: boolean }

const PASSWORD_RESET_TOKEN_HASH_DOMAIN = "defterx/password-reset-token/v1";

class PasswordResetDeliveryError extends Error {}

function assertPasswordResetPepper(pepper: string | undefined): string {
  if (new TextEncoder().encode(pepper ?? "").byteLength < 32) {
    throw new Error("PASSWORD_RESET_TOKEN_PEPPER must contain at least 32 bytes");
  }
  return pepper!;
}

export async function hashPasswordResetToken(rawToken: string, pepper: string): Promise<string> {
  const validPepper = assertPasswordResetPepper(pepper);
  return sha256(`${PASSWORD_RESET_TOKEN_HASH_DOMAIN}\u0000${rawToken}\u0000${validPepper}`);
}

async function createPasswordHash(client: DbClient, password: string): Promise<string> {
  const result = await client.query<{ password_hash: string }>(
    `SELECT crypt(encode(digest($1::text, 'sha256'), 'base64'), gen_salt('bf', 12)) AS password_hash`,
    [password],
  );
  return result.rows[0]!.password_hash;
}

async function issueTokens(client: DbClient, user: { id: string; email: string }, env: Env, familyId: string = crypto.randomUUID()) {
  const refreshToken = randomToken(48);
  const tokenHash = await sha256(refreshToken + env.REFRESH_TOKEN_PEPPER);
  const refreshTtl = Number(env.REFRESH_TOKEN_TTL_SECONDS || 2_592_000);
  const inserted = await client.query<{ id: string }>(
    `INSERT INTO refresh_tokens(user_id,family_id,token_hash,expires_at) VALUES($1,$2,$3,now()+($4*interval '1 second')) RETURNING id`,
    [user.id, familyId, tokenHash, refreshTtl],
  );
  return {
    accessToken: await signAccessToken(user, env.JWT_SECRET, Number(env.ACCESS_TOKEN_TTL_SECONDS || 900)),
    refreshToken,
    refreshTokenId: inserted.rows[0]!.id,
    expiresIn: Number(env.ACCESS_TOKEN_TTL_SECONDS || 900),
  };
}

export async function register(pool: DbClient, env: Env, input: { email: string; password: string; displayName: string }) {
  try {
    return await inTransaction(pool, async (client) => {
      const passwordHash = await createPasswordHash(client, input.password);
      let user: { id: string; email: string; display_name: string };
      try {
        const result = await client.query<{ id: string; email: string; display_name: string }>(
          `INSERT INTO users(email,display_name,status) VALUES($1,$2,'ACTIVE') RETURNING id,email,display_name`, [input.email, input.displayName],
        );
        user = result.rows[0]!;
      } catch (error) {
        if ((error as { code?: string }).code === "23505") throw new AppError(409, "EMAIL_EXISTS", "An account with this email already exists");
        throw error;
      }
      await client.query(`INSERT INTO auth_credentials(user_id,password_hash) VALUES($1,$2)`, [user.id, passwordHash]);
      const book = await createBookWithClient(client,user.id,{name:"Kişisel Defter",bookType:"PERSONAL",baseCurrency:"TRY"});
      const tokens = await issueTokens(client, user, env);
      return { user: { id: user.id, email: user.email, displayName: user.display_name }, book, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn };
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    const errorCode = typeof error === "object" && error && "code" in error ? String(error.code) : undefined;
    console.error(JSON.stringify({ event: "REGISTRATION_FAILED", errorCode }));
    throw new AppError(500, "REGISTRATION_FAILED", "Registration could not be completed");
  }
}

export async function login(pool: DbClient, env: Env, input: { email: string; password: string }) {
  const result = await pool.query<UserRow>(
    `SELECT u.id,u.email,u.display_name FROM users u JOIN auth_credentials c ON c.user_id=u.id
     WHERE lower(u.email)=lower($1)
       AND c.password_hash=crypt(encode(digest($2::text, 'sha256'), 'base64'), c.password_hash)
       AND u.status='ACTIVE' AND u.deleted_at IS NULL`,
    [input.email, input.password],
  );
  const user = result.rows[0];
  if (!user) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  return inTransaction(pool, async (client) => {
    const tokens = await issueTokens(client, user, env);
    return { user: { id: user.id, email: user.email, displayName: user.display_name }, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn };
  });
}

export async function rotateRefreshToken(pool: DbClient, env: Env, rawToken: string) {
  const outcome = await inTransaction(pool, async (client) => {
    const hash = await sha256(rawToken + env.REFRESH_TOKEN_PEPPER);
    const result = await client.query<RefreshRow>(
      `SELECT r.id,r.user_id,r.family_id,r.revoked_at,r.expires_at,u.email FROM refresh_tokens r JOIN users u ON u.id=r.user_id
       WHERE r.token_hash=$1 FOR UPDATE`, [hash],
    );
    const existing = result.rows[0];
    if (!existing) throw new AppError(401, "INVALID_REFRESH_TOKEN", "Refresh token is invalid");
    if (existing.revoked_at) {
      await client.query(`UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE family_id=$1`, [existing.family_id]);
      return { reused: true as const };
    }
    if (new Date(existing.expires_at).getTime() <= Date.now()) throw new AppError(401, "REFRESH_TOKEN_EXPIRED", "Refresh token has expired");
    const next = await issueTokens(client, { id: existing.user_id, email: existing.email }, env, existing.family_id);
    await client.query(`UPDATE refresh_tokens SET revoked_at=now(),replaced_by=$2 WHERE id=$1`, [existing.id, next.refreshTokenId]);
    return { reused: false as const, accessToken: next.accessToken, refreshToken: next.refreshToken, expiresIn: next.expiresIn };
  });
  if (outcome.reused) throw new AppError(401, "REFRESH_TOKEN_REUSE", "Refresh token reuse was detected");
  return { accessToken: outcome.accessToken, refreshToken: outcome.refreshToken, expiresIn: outcome.expiresIn };
}

export async function revokeRefreshToken(pool: DbClient, env: Env, rawToken: string): Promise<void> {
  const hash = await sha256(rawToken + env.REFRESH_TOKEN_PEPPER);
  await pool.query(`UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE token_hash=$1`, [hash]);
}

export async function requestPasswordReset(
  pool: DbClient,
  env: Env,
  input: { email: string },
  mailer: PasswordResetMailer | undefined,
): Promise<void> {
  if (!mailer) {
    throw new AppError(503, "PASSWORD_RESET_EMAIL_UNAVAILABLE", "Password reset email is temporarily unavailable");
  }

  const rawToken = randomToken(48);
  const tokenHash = await hashPasswordResetToken(rawToken, env.PASSWORD_RESET_TOKEN_PEPPER);

  try {
    await inTransaction(pool, async (client) => {
      const result = await client.query<UserRow>(
        `SELECT id,email,display_name
         FROM users
         WHERE lower(email)=lower($1) AND status='ACTIVE' AND deleted_at IS NULL
         FOR UPDATE`,
        [input.email],
      );
      const user = result.rows[0];
      if (!user) return;

      await client.query(
        `UPDATE password_reset_tokens SET used_at=now()
         WHERE user_id=$1 AND used_at IS NULL`,
        [user.id],
      );
      const inserted = await client.query<{ expires_at: Date }>(
        `INSERT INTO password_reset_tokens(user_id,token_hash,expires_at)
         VALUES($1,$2,now()+interval '30 minutes') RETURNING expires_at`,
        [user.id, tokenHash],
      );
      try {
        await mailer.sendPasswordResetEmail({
          recipientEmail: user.email,
          displayName: user.display_name,
          token: rawToken,
          expiresAt: new Date(inserted.rows[0]!.expires_at).toISOString(),
        });
      } catch {
        throw new PasswordResetDeliveryError();
      }
    });
  } catch (error) {
    if (!(error instanceof PasswordResetDeliveryError)) throw error;
    console.error(JSON.stringify({ event: "PASSWORD_RESET_EMAIL_FAILED" }));
    throw new AppError(503, "PASSWORD_RESET_EMAIL_UNAVAILABLE", "Password reset email is temporarily unavailable");
  }
}

export async function resetPassword(
  pool: DbClient,
  env: Env,
  input: { token: string; newPassword: string },
): Promise<void> {
  const tokenHash = await hashPasswordResetToken(input.token, env.PASSWORD_RESET_TOKEN_PEPPER);
  await inTransaction(pool, async (client) => {
    const result = await client.query<PasswordResetRow>(
      `SELECT pr.id,pr.user_id,u.email,
              c.password_hash=crypt(encode(digest($2::text, 'sha256'), 'base64'),c.password_hash) AS new_password_matches
       FROM password_reset_tokens pr
       JOIN users u ON u.id=pr.user_id
       JOIN auth_credentials c ON c.user_id=u.id
       WHERE pr.token_hash=$1 AND pr.used_at IS NULL AND pr.expires_at>now()
         AND u.status='ACTIVE' AND u.deleted_at IS NULL
       FOR UPDATE OF pr,u,c`,
      [tokenHash, input.newPassword],
    );
    const existing = result.rows[0];
    if (!existing) {
      throw new AppError(400, "INVALID_PASSWORD_RESET_TOKEN", "Password reset token is invalid or expired");
    }
    if (existing.new_password_matches) {
      throw new AppError(422, "PASSWORD_UNCHANGED", "New password must be different from the current password");
    }

    const passwordHash = await createPasswordHash(client, input.newPassword);
    await client.query(
      `UPDATE auth_credentials SET password_hash=$2,updated_at=now() WHERE user_id=$1`,
      [existing.user_id, passwordHash],
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at=now()
       WHERE user_id=$1 AND used_at IS NULL`,
      [existing.user_id],
    );
    await client.query(
      `UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1`,
      [existing.user_id],
    );
  });
}

export async function changePassword(
  pool: DbClient,
  env: Env,
  userId: string,
  input: { currentPassword: string; newPassword: string },
) {
  return inTransaction(pool, async (client) => {
    const result = await client.query<PasswordCredentialRow>(
      `SELECT u.id,u.email,
              c.password_hash=crypt(encode(digest($2::text, 'sha256'), 'base64'),c.password_hash) AS current_password_matches,
              c.password_hash=crypt(encode(digest($3::text, 'sha256'), 'base64'),c.password_hash) AS new_password_matches
       FROM users u
       JOIN auth_credentials c ON c.user_id=u.id
       WHERE u.id=$1 AND u.status='ACTIVE' AND u.deleted_at IS NULL
       FOR UPDATE OF u,c`,
      [userId, input.currentPassword, input.newPassword],
    );
    const user = result.rows[0];
    if (!user?.current_password_matches) {
      throw new AppError(401, "INVALID_CURRENT_PASSWORD", "Current password is incorrect");
    }
    if (user.new_password_matches) {
      throw new AppError(422, "PASSWORD_UNCHANGED", "New password must be different from the current password");
    }

    const passwordHash = await createPasswordHash(client, input.newPassword);
    await client.query(
      `UPDATE auth_credentials SET password_hash=$2,updated_at=now() WHERE user_id=$1`,
      [user.id, passwordHash],
    );
    await client.query(
      `UPDATE password_reset_tokens SET used_at=now()
       WHERE user_id=$1 AND used_at IS NULL`,
      [user.id],
    );
    const tokens = await issueTokens(client, user, env);
    await client.query(
      `UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now())
       WHERE user_id=$1 AND id<>$2`,
      [user.id, tokens.refreshTokenId],
    );
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
    };
  });
}
