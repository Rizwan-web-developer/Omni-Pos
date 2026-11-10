import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import {
  AUTH_COOKIE,
  SESSION_MAX_AGE,
  getAuthSecret,
  signSession,
  verifySession,
  type SessionPayload,
  type SessionRole,
} from "./edge";

export { AUTH_COOKIE, SESSION_MAX_AGE, type SessionPayload, type SessionRole };

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P }).toString("base64url");
  return `scrypt$${SCRYPT_N}$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const parts = stored.split("$");
    if (parts[0] !== "scrypt" || parts.length !== 4) return false;
    const n = Number(parts[1]) || SCRYPT_N;
    const salt = parts[2];
    const expected = Buffer.from(parts[3], "base64url");
    const actual = scryptSync(password, salt, expected.length, { N: n, r: SCRYPT_R, p: SCRYPT_P });
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validatePassword(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password))
    return "Use upper/lower case letters and a number.";
  return null;
}

export async function createSessionCookie(payload: Omit<SessionPayload, "iat" | "exp">): Promise<string> {
  return signSession(payload, getAuthSecret());
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(AUTH_COOKIE)?.value;
  return verifySession(token, getAuthSecret());
}

export function sessionCookieOptions() {
  return {
    name: AUTH_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function isPlatformAdmin(role: string | undefined | null): boolean {
  return role === "SUPER_ADMIN" || role === "SUB_ADMIN";
}

export async function requirePlatformAdmin(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session.role)) return null;
  // Ensure user still active
  const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { isActive: true, role: true } });
  if (!user?.isActive || !isPlatformAdmin(user.role)) return null;
  return session;
}

/** Platform admin OR a tenant user accessing their own tenant's resources. */
export async function requireTenantAccess(tenantId: string): Promise<{ session: SessionPayload; admin: boolean } | null> {
  const session = await getSession();
  if (!session) return null;
  if (isPlatformAdmin(session.role)) return { session, admin: true };
  if (session.tenantId && session.tenantId === tenantId) {
    // Ensure the user is still active and bound to this tenant
    const user = await prisma.user.findUnique({ where: { id: session.sub }, select: { isActive: true, tenantId: true } });
    if (!user?.isActive || user.tenantId !== tenantId) return null;
    return { session, admin: false };
  }
  return null;
}

/** Logged-in tenant (shop) user bound to `tenantId`. Admins also allowed (returns admin:true). */
export async function requireShopAccess(tenantId: string) {
  return requireTenantAccess(tenantId);
}
