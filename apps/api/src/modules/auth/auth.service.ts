import { AppError } from "../../common/errors";
import { randomToken, sha256, signAccessToken } from "../../common/crypto";
import { inTransaction } from "../../infrastructure/database";
import type { Env } from "../../config/bindings";
import type { DbClient } from "../../infrastructure/database";
import { createBookWithClient } from "../books/book.service";

interface UserRow { id: string; email: string; display_name: string }
interface RefreshRow { id: string; user_id: string; family_id: string; revoked_at: Date | null; expires_at: Date; email: string }

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
      const passwordHashResult = await client.query<{ password_hash: string }>(
        `SELECT crypt(encode(digest($1::text, 'sha256'), 'base64'), gen_salt('bf', 12)) AS password_hash`,
        [input.password],
      );
      const passwordHash = passwordHashResult.rows[0]!.password_hash;
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
