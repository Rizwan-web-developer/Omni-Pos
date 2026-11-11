import { NextResponse } from "next/server";
import { AccountType, BusinessStatus } from "@prisma/client";

import { prisma } from "@/lib/db";
import { normalizeEmail, requirePlatformAdmin, requireTenantAccess } from "@/lib/auth/server";
import { fromAccountType, fromBusinessStatus, fromIndustryType, fromPlanTier, toBusinessStatus, toIndustryType, toPlanTier } from "@/lib/mappers";
import { PLAN_BY_KEY } from "@/lib/data";
import { computeValidUntil, PACKAGE_PKR } from "@/lib/subscription";
import { getTenantFeatureKeys, setTenantFeatures } from "@/lib/tenant-features";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let business = await prisma.tenant.findUnique({
    where: { id: params.id },
    include: {
      users: { select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!business) return NextResponse.json({ message: "Business not found." }, { status: 404 });

  // Lazy demo/subscription expiry enforcement (data preserved)
  const now = new Date();
  const demoExpired = business.accountType === AccountType.DEMO && business.trialEndsAt && business.trialEndsAt.getTime() <= now.getTime();
  const subExpired = (business as any).subscriptionPaidUntil && new Date((business as any).subscriptionPaidUntil).getTime() <= now.getTime();
  if ((demoExpired || subExpired) && business.status !== BusinessStatus.DEACTIVE) {
    business = await prisma.tenant.update({
      where: { id: business.id },
      data: { status: BusinessStatus.DEACTIVE, isActive: false },
      include: { users: { select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true }, orderBy: { createdAt: "asc" } } },
    });
  }
  const features = await getTenantFeatureKeys(business.id);
  return NextResponse.json({ business: { ...business, features }, features });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const existing = await prisma.tenant.findUnique({ where: { id: params.id }, select: { id: true, slug: true } });
    if (!existing) return NextResponse.json({ message: "Business not found." }, { status: 404 });

    const data: Record<string, unknown> = {};
    const featuresInput = Array.isArray(body.features)
      ? (body.features as unknown[]).map((value) => String(value))
      : null;

    if (typeof body.name === "string" && body.name.trim().length >= 2) data.businessName = body.name.trim();
    if (typeof body.slug === "string") {
      const slug = body.slug.trim().toLowerCase();
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3) return NextResponse.json({ message: "Invalid workspace/slug." }, { status: 400 });
      if (slug !== existing.slug) {
        const conflict = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } }).catch(() => null);
        if (conflict) return NextResponse.json({ message: "Workspace ID/slug is already in use." }, { status: 409 });
      }
      data.slug = slug;
    }
    if (typeof body.owner === "string") data.ownerName = body.owner.trim();
    if (typeof body.email === "string") {
      const email = normalizeEmail(body.email);
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ message: "Invalid email." }, { status: 400 });
      if (email) data.email = email;
    }
    if (typeof body.phone === "string") data.phone = body.phone.trim() || null;
    if (typeof body.location === "string") data.location = body.location.trim() || null;
    if (typeof body.industry === "string") data.industryType = toIndustryType(body.industry);
    if (typeof body.plan === "string") {
      data.subscriptionTier = toPlanTier(body.plan);
      const planKey = fromPlanTier(toPlanTier(body.plan));
      data.mrr = PLAN_BY_KEY[planKey]?.price ?? 0;
    }
    if (typeof body.status === "string") {
      const st = toBusinessStatus(body.status);
      data.status = st;
      data.isActive = st === "ACTIVE" || st === "TRIAL";
    }
    // Convert Demo -> Real (data preserved) AND mark as paid from this exact time (current month voucher PAID, 35-day window)
    const convertToReal = body.convertToReal === true || String(body.accountType ?? "").toLowerCase() === "real";
    if (convertToReal) {
      const now = new Date();
      const validUntil = computeValidUntil(now, 1);
      data.accountType = AccountType.REAL;
      data.convertedAt = now;
      data.status = BusinessStatus.ACTIVE;
      data.isActive = true;
      data.trialEndsAt = null;
      data.lastPaidAt = now;
      data.subscriptionPaidUntil = validUntil;

      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const label = `${year}-${String(month).padStart(2, "0")}`;
      const [business] = await prisma.$transaction([
        prisma.tenant.update({
          where: { id: params.id },
          data: data as any,
          include: { users: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
        }),
        prisma.subscriptionVoucher.upsert({
          where: { tenantId_year_month: { tenantId: params.id, year, month } },
          create: { tenantId: params.id, year, month, label, amountPkr: PACKAGE_PKR, status: "PAID" as any, paidAt: now, validUntil, notes: "Auto-paid on Demo→Real conversion" },
          update: { status: "PAID" as any, paidAt: now, validUntil, notes: "Auto-paid on Demo→Real conversion" },
        }),
      ]);
      const features = featuresInput ? await setTenantFeatures(params.id, featuresInput) : await getTenantFeatureKeys(params.id);

      return NextResponse.json({
        business: { ...business, features },
        features,
        mapped: {
          status: fromBusinessStatus(business.status),
          industry: fromIndustryType(business.industryType),
          plan: fromPlanTier(business.subscriptionTier),
          accountType: fromAccountType(business.accountType),
        },
        paid: { paidAt: now, validUntil, days: 35, voucher: label },
      });
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No valid changes provided." }, { status: 400 });

    const business = await prisma.tenant.update({
      where: { id: params.id },
      data: data as any,
      include: { users: { select: { id: true, name: true, email: true, role: true, isActive: true } } },
    });
    const features = featuresInput ? await setTenantFeatures(params.id, featuresInput) : await getTenantFeatureKeys(params.id);

    return NextResponse.json({
      business: { ...business, features },
      features,
      mapped: {
        status: fromBusinessStatus(business.status),
        industry: fromIndustryType(business.industryType),
        plan: fromPlanTier(business.subscriptionTier),
        accountType: fromAccountType(business.accountType),
      },
    });
  } catch (error) {
    console.error("Update business error:", error);
    return NextResponse.json({ message: "Failed to update business." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const tenantId = params.id;
    const existing = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, businessName: true } });
    if (!existing) return NextResponse.json({ message: "Business not found." }, { status: 404 });

    // Explicit ordered cleanup to satisfy Restrict FKs (e.g. InvoiceItem.product -> Product) and remove tenant-scoped rows.
    await prisma.$transaction(async (tx) => {
      const t: any = tx as any;
      // Invoice items reference products (Restrict) and serials; remove them before products/serials/invoices.
      await t.invoiceItem.deleteMany({ where: { invoice: { tenantId } } });
      await t.invoice.deleteMany({ where: { tenantId } });

      // Serials belong to products/tenant; remove explicitly (tenantId FK not modeled as a Tenant relation).
      await t.serialItem.deleteMany({ where: { tenantId } });

      // Product extension rows (cascade from product in schema, but explicit is safe).
      await t.mobileItem.deleteMany({ where: { product: { tenantId } } });
      await t.pharmacyItem.deleteMany({ where: { product: { tenantId } } });
      await t.electronicsItem.deleteMany({ where: { product: { tenantId } } });

      await t.product.deleteMany({ where: { tenantId } });
      await t.brand.deleteMany({ where: { tenantId } });
      await t.category.deleteMany({ where: { tenantId } });

      await t.subscriptionVoucher.deleteMany({ where: { tenantId } });
      await t.billingInvoice.deleteMany({ where: { tenantId } });
      await t.businessSubscription.deleteMany({ where: { tenantId } });
      await t.syncHealthLog.deleteMany({ where: { tenantId } });
      await t.supportTicket.deleteMany({ where: { tenantId } });
      await t.user.deleteMany({ where: { tenantId } });

      await t.tenant.delete({ where: { id: tenantId } });
    });

    return NextResponse.json({ ok: true, deletedId: existing.id, name: existing.businessName });
  } catch (error) {
    console.error("Delete business error:", error);
    return NextResponse.json({ message: "Failed to delete business." }, { status: 500 });
  }
}
