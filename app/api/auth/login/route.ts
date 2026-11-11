import { NextResponse } from "next/server";
import { AccountType, BusinessStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  createSessionCookie,
  normalizeEmail,
  sessionCookieOptions,
  verifyPassword,
  type SessionRole,
} from "@/lib/auth/server";
import { enforceTenantExpiry, isDemoExpired, isSubscriptionExpired } from "@/lib/subscription";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = normalizeEmail(String(body?.email ?? ""));
    const password = String(body?.password ?? "");
    if (!email || !password) {
      return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true, name: true, email: true, passwordHash: true, role: true, tenantId: true, isActive: true,
        tenant: { select: { id: true, accountType: true, trialEndsAt: true, subscriptionPaidUntil: true, status: true } },
      },
    });
    if (!user || !user.isActive || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    // Demo/subscription expiry: auto-lock (Deactive) — data preserved
    if (user.tenant) {
      const t = user.tenant;
      const now = new Date();
      if (isDemoExpired(t as any, now) || isSubscriptionExpired(t as any, now)) {
        await enforceTenantExpiry(prisma, t as any, now);
        const msg = isDemoExpired(t as any, now)
          ? "Demo period (7 days) has ended. Account is locked but your data is preserved. Contact admin to convert to a Real account."
          : "Subscription period has ended (35-day paid window expired). Account is auto-locked but your data is preserved. Contact admin to renew.";
        return NextResponse.json({ message: msg }, { status: 403 });
      }
      if (t.status === BusinessStatus.DEACTIVE) {
        return NextResponse.json({ message: "This account is deactivated (locked). Contact admin. Your data is preserved." }, { status: 403 });
      }
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } }).catch(() => {});

    const token = await createSessionCookie({
      sub: user.id,
      role: user.role as SessionRole,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
    });

    const isAdmin = user.role === "SUPER_ADMIN" || user.role === "SUB_ADMIN";
    const redirectTo = isAdmin ? "/" : user.tenantId ? `/store/${user.tenantId}` : "/login";
    const res = NextResponse.json(
      { message: "Login successful", role: user.role, name: user.name, tenantId: user.tenantId, redirectTo },
      { status: 200 },
    );
    const opts = sessionCookieOptions();
    res.cookies.set({ ...opts, value: token });
    return res;
  } catch (error) {
    console.error("Login error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    // Surface actionable config errors (helps diagnose Vercel env/DB issues) without leaking secrets.
    if (/AUTH_SECRET/i.test(msg)) {
      return NextResponse.json({ message: "Server config error: AUTH_SECRET is missing or invalid. Set it in Vercel env and redeploy." }, { status: 500 });
    }
    if (/Prisma|database|Can't reach|P100|Authentication failed|ECONN|connect/i.test(msg)) {
      return NextResponse.json({ message: "Database connection/config error. Check DATABASE_URL in Vercel env and redeploy." }, { status: 500 });
    }
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}
