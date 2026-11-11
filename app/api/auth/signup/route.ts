import { NextResponse } from "next/server";
import { AccountType, BusinessStatus, UserRole } from "@prisma/client";

import { prisma } from "@/lib/db";
import {
  createSessionCookie,
  hashPassword,
  normalizeEmail,
  sessionCookieOptions,
  validatePassword,
  type SessionRole,
} from "@/lib/auth/server";
import { recommendedFeatures } from "@/lib/features";
import { toIndustryType, toPlanTier } from "@/lib/mappers";
import { setTenantFeatures } from "@/lib/tenant-features";
import { slugify } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ALLOWED_INDUSTRIES = new Set([
  "mobile",
  "electronics",
  "cosmetics-shop",
  "pharmacy",
  "paint-shop",
  "hardware-shop",
]);

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

/**
 * Public SaaS signup — creates a 7-day Trial Demo business with the owner login.
 * Bulk quantity stock, POS and invoices are always included; industry-recommended
 * features are granted from the Access catalog.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const ownerName = String(body?.ownerName ?? "").trim() || name;
    const email = normalizeEmail(String(body?.email ?? ""));
    const phone = String(body?.phone ?? "").trim();
    const location = String(body?.location ?? "").trim();
    const password = String(body?.password ?? "");
    const industry = String(body?.industry ?? "mobile");
    const packageKey = String(body?.package ?? "starter").trim().toLowerCase();

    if (name.length < 2) return NextResponse.json({ message: "Business name is required." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ message: "Enter a valid email address." }, { status: 400 });
    }
    if (!phone) return NextResponse.json({ message: "Phone number is required." }, { status: 400 });
    if (!location) return NextResponse.json({ message: "Business location is required." }, { status: 400 });
    if (!ALLOWED_INDUSTRIES.has(industry)) {
      return NextResponse.json({ message: "Choose a valid business category." }, { status: 400 });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return NextResponse.json({ message: passwordError }, { status: 400 });

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) return NextResponse.json({ message: "This email already has an account. Please sign in." }, { status: 409 });

    const slug = await uniqueSlug(name);
    const uid = `BUS-${Math.floor(1000 + Math.random() * 9000)}`;
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const business = await prisma.tenant.create({
      data: {
        uid,
        businessName: name,
        slug,
        industryType: toIndustryType(industry),
        subscriptionTier: toPlanTier(packageKey),
        accountType: AccountType.DEMO,
        status: BusinessStatus.TRIAL,
        isActive: true,
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

    const requested = Array.isArray(body?.features)
      ? (body.features as unknown[]).map((value) => String(value))
      : recommendedFeatures(industry);
    await setTenantFeatures(business.id, requested);

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
        message: "Account created. Your 7-day trial is active.",
        business: {
          id: business.id,
          uid: business.uid,
          businessName: business.businessName,
          slug: business.slug,
          industryType: business.industryType,
          trialEndsAt: business.trialEndsAt,
        },
        redirectTo: `/store/${business.id}`,
      },
      { status: 201 },
    );
    res.cookies.set({ ...sessionCookieOptions(), value: token });
    return res;
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json({ message: "Could not create the account. Please try again." }, { status: 500 });
  }
}
