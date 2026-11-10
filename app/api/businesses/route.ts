import { NextResponse } from "next/server";
import { AccountType, UserRole, BusinessStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { hashPassword, normalizeEmail, requirePlatformAdmin } from "@/lib/auth/server";
import { toAccountType, toIndustryType } from "@/lib/mappers";
import { slugify } from "@/lib/utils";

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

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Lazy expiry enforcement: lock expired demos/subscriptions (data preserved)
  const now = new Date();
  await Promise.all([
    prisma.tenant.updateMany({
      where: { accountType: AccountType.DEMO, trialEndsAt: { lte: now }, status: { not: BusinessStatus.DEACTIVE } },
      data: { status: BusinessStatus.DEACTIVE, isActive: false },
    }),
    prisma.tenant.updateMany({
      where: { subscriptionPaidUntil: { lte: now }, status: { not: BusinessStatus.DEACTIVE } },
      data: { status: BusinessStatus.DEACTIVE, isActive: false },
    }),
  ]).catch(() => {});

  const businesses = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  return NextResponse.json({ businesses });
}

export async function POST(req: Request) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const email = normalizeEmail(String(body?.email ?? ""));
    const phone = String(body?.phone ?? "").trim();
    const location = String(body?.location ?? "").trim();
    const password = String(body?.password ?? "");
    const industry = String(body?.industry ?? "");
    const accountType = toAccountType(String(body?.accountType ?? "real"));

    if (name.length < 2) return NextResponse.json({ message: "Business name is required." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ message: "Valid email is required." }, { status: 400 });
    if (!phone) return NextResponse.json({ message: "Phone number is required." }, { status: 400 });
    if (!location) return NextResponse.json({ message: "Location is required." }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ message: "Password must be at least 8 characters." }, { status: 400 });

    const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existingUser) return NextResponse.json({ message: "This email is already used by another account." }, { status: 409 });

    const slug = await uniqueSlug(name);
    const uid = `BUS-${Math.floor(1000 + Math.random() * 9000)}`;
    const isDemo = accountType === AccountType.DEMO;
    const trialEndsAt = isDemo ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) : null;
    const status = isDemo ? BusinessStatus.TRIAL : BusinessStatus.ACTIVE;

    const business = await prisma.tenant.create({
      data: {
        uid,
        businessName: name,
        slug,
        industryType: toIndustryType(industry),
        subscriptionTier: "STARTER" as any,
        accountType,
        status,
        isActive: true,
        trialEndsAt,
        ownerName: name,
        email,
        phone: phone || null,
        location: location || null,
        mrr: 0,
        users: {
          create: {
            name,
            email,
            passwordHash: hashPassword(password),
            role: UserRole.OWNER,
            isActive: true,
          },
        },
      },
      include: { users: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
    });

    // Return credentials (password was admin-set at creation; never stored in plaintext)
    return NextResponse.json(
      {
        business,
        credentials: {
          email,
          password,
          note: isDemo
            ? "Demo (7 days). After 7 days account auto-locks (Deactive) — data preserved. Convert to Real from admin panel."
            : "Login credentials set. Super Admin can reset password anytime.",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create business error:", error);
    return NextResponse.json({ message: "Failed to create business." }, { status: 500 });
  }
}
