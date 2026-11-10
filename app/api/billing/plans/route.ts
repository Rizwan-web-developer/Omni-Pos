import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/server";
import { PlanTier } from "@prisma/client";
import { PACKAGE_PKR } from "@/lib/subscription";

const DEFAULT_PLANS = [
  { key: PlanTier.STARTER, name: "Full Panel", pricePkr: PACKAGE_PKR, features: ["Full panel access", "All modules (category-based)", "PKR 15,000 / month per business"] },
  { key: PlanTier.PRO, name: "Pro (legacy)", pricePkr: 45000, features: ["Legacy tier"], isActive: false },
  { key: PlanTier.ENTERPRISE, name: "Enterprise (legacy)", pricePkr: 120000, features: ["Legacy tier"], isActive: false },
];

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let plans = await prisma.subscriptionPlan.findMany({ orderBy: { pricePkr: "asc" } });
  if (plans.length === 0) {
    await prisma.subscriptionPlan.createMany({ data: DEFAULT_PLANS as any, skipDuplicates: true });
    plans = await prisma.subscriptionPlan.findMany({ orderBy: { pricePkr: "asc" } });
  } else {
    // Ensure the canonical single package exists/reflects 15000
    await prisma.subscriptionPlan.upsert({
      where: { key: PlanTier.STARTER },
      create: DEFAULT_PLANS[0] as any,
      update: { name: "Full Panel", pricePkr: PACKAGE_PKR, isActive: true, features: DEFAULT_PLANS[0].features },
    }).catch(() => {});
    plans = await prisma.subscriptionPlan.findMany({ orderBy: { pricePkr: "asc" } });
  }

  const now = new Date();
  // Lazy-lock expired subscriptions so view is accurate
  await prisma.tenant.updateMany({
    where: { subscriptionPaidUntil: { lte: now }, status: { not: "DEACTIVE" as any } },
    data: { status: "DEACTIVE" as any, isActive: false },
  }).catch(() => {});

  const [tenants, voucherAgg] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, uid: true, businessName: true, status: true, accountType: true, isActive: true,
        subscriptionPaidUntil: true, lastPaidAt: true, email: true, phone: true,
      },
    }),
    prisma.subscriptionVoucher.groupBy({ by: ["tenantId", "status"], _count: { _all: true } }),
  ]);

  const countsByTenant: Record<string, { paid: number; unpaid: number }> = {};
  for (const row of voucherAgg as any[]) {
    const t = countsByTenant[row.tenantId] || { paid: 0, unpaid: 0 };
    if (row.status === "PAID") t.paid += row._count._all; else if (row.status === "UNPAID") t.unpaid += row._count._all;
    countsByTenant[row.tenantId] = t;
  }

  const businesses = tenants.map((t: any) => {
    const paidWindowValid = t.subscriptionPaidUntil && new Date(t.subscriptionPaidUntil).getTime() > now.getTime();
    const isRealActive = String(t.accountType) === "REAL" && String(t.status) === "ACTIVE";
    // Per requirement: Real + Active accounts = paid subscriptions
    const paid = isRealActive || paidWindowValid;
    return {
      ...t,
      paid,
      paidWindowValid,
      voucherPaid: countsByTenant[t.id]?.paid ?? 0,
      voucherUnpaid: countsByTenant[t.id]?.unpaid ?? 0,
    };
  });

  const activePaid = businesses.filter((b: any) => b.paid).length;
  const realActive = businesses.filter((b: any) => String(b.accountType) === "REAL" && String(b.status) === "ACTIVE").length;
  const mrr = activePaid * PACKAGE_PKR; // single package per active paid business

  return NextResponse.json({
    package: { name: "Full Panel (all features)", amountPkr: PACKAGE_PKR, periodDays: 35, rule: "1 voucher = 35 days; N vouchers paid together = N*30+5 days. Auto-locks on expiry (data preserved)." },
    plans: plans.filter((p: any) => p.key === "STARTER" || p.isActive !== false),
    businesses,
    metrics: { mrr, activePaid, realActive, businesses: businesses.length, packagePkr: PACKAGE_PKR },
    // backward-compat keys (avoid breaking old renders)
    subscriptions: [],
    invoices: [],
  });
}
