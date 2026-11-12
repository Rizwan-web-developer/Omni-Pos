import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { normalizeEmail, validatePassword, verifyPassword } from "@/lib/auth/server";
import { issueOtp } from "@/lib/otp";
import { toIndustryType, toPlanTier } from "@/lib/mappers";
import { recommendedFeatures } from "@/lib/features";
import { slugify } from "@/lib/utils";
import { enforceTenantExpiry, isDemoExpired, isSubscriptionExpired } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const ALLOWED_INDUSTRIES = new Set([
  "mobile", "electronics", "cosmetics-shop", "pharmacy", "paint-shop", "hardware-shop", "grocery",
]);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const purpose = String(body?.purpose ?? "").toUpperCase();
    const email = normalizeEmail(String(body?.email ?? ""));
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
    }

    if (purpose === "LOGIN") {
      const password = String(body?.password ?? "");
      if (!password) return NextResponse.json({ message: "Password is required." }, { status: 400 });
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
      if (user.tenant) {
        const t = user.tenant as any;
        const now = new Date();
        if (isDemoExpired(t, now) || isSubscriptionExpired(t, now)) {
          await enforceTenantExpiry(prisma, t, now);
          return NextResponse.json({
            message: "Your 7-day trial or subscription has ended. Upgrade to Pro to continue.",
            code: "UPGRADE_REQUIRED",
            upgrade: true,
          }, { status: 403 });
        }
        if (t.status === "DEACTIVE") {
          return NextResponse.json({ message: "This account is locked. Your data is preserved. Contact support to upgrade." }, { status: 403 });
        }
      }
      await issueOtp(email, "LOGIN");
      return NextResponse.json({ ok: true, step: "otp", purpose: "LOGIN", email, message: "Verification code sent to your email." });
    }

    if (purpose === "SIGNUP") {
      const name = String(body?.name ?? "").trim();
      const ownerName = String(body?.ownerName ?? "").trim() || name;
      const phone = String(body?.phone ?? "").trim();
      const location = String(body?.location ?? "").trim();
      const password = String(body?.password ?? "");
      const industry = String(body?.industry ?? "electronics");
      const packageKey = String(body?.package ?? "starter").trim().toLowerCase();

      if (name.length < 2) return NextResponse.json({ message: "Business name is required." }, { status: 400 });
      if (!phone) return NextResponse.json({ message: "Phone number is required." }, { status: 400 });
      if (!location) return NextResponse.json({ message: "Business location is required." }, { status: 400 });
      if (!ALLOWED_INDUSTRIES.has(industry)) {
        return NextResponse.json({ message: "Choose a valid business category." }, { status: 400 });
      }
      const passwordError = validatePassword(password);
      if (passwordError) return NextResponse.json({ message: passwordError }, { status: 400 });

      const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existingUser) return NextResponse.json({ message: "This email already has an account. Please sign in." }, { status: 409 });

      const payload = { name, ownerName, phone, location, password, industry, package: packageKey };
      await issueOtp(email, "SIGNUP", payload);
      return NextResponse.json({ ok: true, step: "otp", purpose: "SIGNUP", email, message: "Verification code sent to your email." });
    }

    return NextResponse.json({ message: "Invalid OTP purpose." }, { status: 400 });
  } catch (error) {
    console.error("OTP send error:", error);
    return NextResponse.json({ message: "Could not send the verification code. Please try again." }, { status: 500 });
  }
}
