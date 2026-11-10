/**
 * Edge-safe auth token helpers (HMAC-SHA256 via Web Crypto). Used by middleware.
 * No Node-only APIs.
 */
export const AUTH_COOKIE = "omnipos_auth";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export type SessionRole = "SUPER_ADMIN" | "SUB_ADMIN" | "OWNER" | "MANAGER" | "CASHIER";

export interface SessionPayload {
  sub: string; // user id
  role: SessionRole;
  tenantId?: string | null;
  email: string;
  name: string;
  iat: number;
  exp: number;
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(str: string): Uint8Array<ArrayBuffer> {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey("raw", enc.encode(secret) as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signSession(payload: Omit<SessionPayload, "iat" | "exp">, secret: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const full: SessionPayload = { ...payload, iat: now, exp: now + SESSION_MAX_AGE };
  const body = toBase64Url(new TextEncoder().encode(JSON.stringify(full)));
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body) as BufferSource);
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined | null, secret: string): Promise<SessionPayload | null> {
  if (!token || !secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sigPart] = parts;
  try {
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, fromBase64Url(sigPart) as BufferSource, new TextEncoder().encode(body) as BufferSource);
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (!payload?.sub || !payload?.exp) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (secret && secret.length >= 16) return secret;
  // Fail closed in production; allow a dev-only fallback so local setup works if env missing.
  if (process.env.NODE_ENV !== "production") return "dev-only-insecure-secret-change-me-please-32";
  throw new Error("AUTH_SECRET is required in production");
}
