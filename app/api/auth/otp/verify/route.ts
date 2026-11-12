import { NextResponse } from "next/server";
import { AccountType, BusinessStatus, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";
import { consumeOtp } from "@/lib/otp";
import {
  createSessionCookie,
  hashPassword,
  normalizeEmail,
  sessionCookieOptions,
  type SessionRole,
} from "@/lib/auth/server";
import { recommendedFeatures, FEATURE_KEYS } from "@/lib/features";
import { toIndustryType, toPlanTier } from "@/lib/mappers";
import { setTenantFeatures } from "@/lib/tenant-features";
import { slugify } from "@/lib/utils";
import { enforceTenantExpiry, isDemoExpired, isSubscriptionExpired } from "@/lib/subscription";

export const dynamic = "force-dynamic";

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "business";
  let candidate = root.slice(0, 40);
  for (let i = 0; i < 50; i++) {
    const exists = await prisma.tenant.findUnique({ where: { slug: candidate }, select: { id: true } }).catch(() => null);
    if (!exists) return candidate;
    candidate = `${root.slice(0, 32)}-${Math.floor(1000 + Math.random() * 9000)}`;
  }
  return `${root.slice(0, 28)}-${Date.now().toString().slice(-6)}`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const purpose = String(body?.purpose ?? "").toUpperCase();
    const email = normalizeEmail(String(body?.email ?? ""));
    const code = String(body?.code ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ message: "Enter the 6-digit verification code." }, { status: 400 });
    }

    if (purpose === "LOGIN") {
      const result = await consumeOtp(email, "LOGIN", code);
      if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });

      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          id: true, name: true, email: true, role: true, tenantId: true, isActive: true,
          tenant: { select: { id: true, accountType: true, trialEndsAt: true, subscriptionPaidUntil: true, status: true } },
        },
      });
      if (!user || !user.isActive) return NextResponse.json({ message: "Account not found or inactive." }, { status: 401 });
      if (user.tenant) {
        const t = user.tenant as any;
        const now = new Date();
        if (isDemoExpired(t, now) || isSubscriptionExpired(t, now)) {
          await enforceTenantExpiry(prisma, t, now);
          return NextResponse.json({ message: "Your 7-day trial or subscription has ended. Upgrade to Pro to continue.", code: "UPGRADE_REQUIRED", upgrade: true }, { status: 403 });
        }
        if (t.status === "DEACTIVE") {
          return NextResponse.json({ message: "This account is locked. Your data is preserved. Contact support to upgrade." }, { status: 403 });
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
      const redirectTo = isAdmin ? "/dashboard" : user.tenantId ? `/store/${user.tenantId}` : "/login";
      const res = NextResponse.json({ message: "Login successful", role: user.role, name: user.name, tenantId: user.tenantId, redirectTo }, { status: 200 });
      res.cookies.set({ ...sessionCookieOptions(), value: token });
      return res;
    }

    if (purpose === "SIGNUP") {
      const result = await consumeOtp(email, "SIGNUP", code);
      if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
      const payload = (result.payload ?? {}) as Record<string, any>;
      const name = String(payload.name ?? "").trim();
      const ownerName = String(payload.ownerName ?? name).trim() || name;
      const phone = String(payload.phone ?? "").trim();
      const location = String(payload.location ?? "").trim();
      const password = String(payload.password ?? "");
      const industry = String(payload.industry ?? "electronics");
      const packageKey = String(payload.package ?? "starter").trim().toLowerCase();
      if (!name || !password) return NextResponse.json({ message: "Signup session expired. Please start again." }, { status: 400 });

      const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existingUser) return NextResponse.json({ message: "This email already has an account. Please sign in." }, { status: 409 });

      const slug = await uniqueSlug(name);
      const uid = `BUS-${Math.floor(1000 + Math.random() * 9000)}`;
      const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const now = new Date();

      const business = await prisma.tenant.create({
        data: {
          uid,
          businessName: name,
          slug,
          industryType: toIndustryType(industry),
          subscriptionTier: toPlanTier(packageKey),
          accountType: AccountType.DEMO,
          billingMode: "INTERNATIONAL_AUTO" as any,
          status: BusinessStatus.TRIAL,
          isActive: true,
          trialStartedAt: now,
          trialEndsAt,
          ownerName,
          email,
          phone: phone || null,
          location: location || null,
          mrr: 0,
          users: {
            create: {
              name: ownerName,
              email,
              passwordHash: hashPassword(password),
              role: UserRole.OWNER,
              isActive: true,
            },
          },
        },
        include: { users: { select: { id: true, email: true } } },
      });

      // 7-day trial gets full access to all optional features.
      await setTenantFeatures(business.id, [...FEATURE_KEYS]);

      const owner = business.users[0];
      const token = await createSessionCookie({
        sub: owner?.id ?? business.id,
        role: UserRole.OWNER as SessionRole,
        tenantId: business.id,
        email,
        name: ownerName,
      });

      const res = NextResponse.json(
        {
          message: "Account created. Your 7-day free trial is active with full access.",
          business: { id: business.id, uid: business.uid, businessName: business.businessName, slug: business.slug, trialEndsAt: business.trialEndsAt },
          redirectTo: `/store/${business.id}`,
        },
        { status: 201 },
      );
      res.cookies.set({ ...sessionCookieOptions(), value: token });
      return res;
    }

    return NextResponse.json({ message: "Invalid OTP purpose." }, { status: 400 });
  } catch (error) {
    console.error("OTP verify error:", error);
    return NextResponse.json({ message: "Could not verify the code. Please try again." }, { status: 500 });
  }
}
