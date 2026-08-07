const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function sha256(value: string): Promise<string> {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

export function randomToken(bytes = 32): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return bytesToBase64Url(value);
}

export interface AccessTokenClaims { sub: string; email: string; iat: number; exp: number; type: "access" }

export async function signAccessToken(user: { id: string; email: string }, secret: string, ttlSeconds: number): Promise<string> {
  if (encoder.encode(secret).byteLength < 32) throw new Error("JWT_SECRET must contain at least 32 bytes");
  const now = Math.floor(Date.now() / 1000);
  const header = bytesToBase64Url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ sub: user.id, email: user.email, iat: now, exp: now + ttlSeconds, type: "access" })));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${payload}`));
  return `${header}.${payload}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyAccessToken(token: string, secret: string): Promise<AccessTokenClaims> {
  if (encoder.encode(secret).byteLength < 32) throw new Error("JWT_SECRET must contain at least 32 bytes");
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) throw new Error("Malformed token");
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, base64UrlToBytes(signature), encoder.encode(`${header}.${payload}`));
  if (!valid) throw new Error("Invalid token");
  const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as AccessTokenClaims;
  if (claims.type !== "access" || claims.exp <= Math.floor(Date.now() / 1000)) throw new Error("Expired token");
  return claims;
}
