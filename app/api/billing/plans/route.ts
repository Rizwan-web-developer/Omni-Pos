import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/server";
import { PlanTier } from "@prisma/client";
import { PACKAGE_PRICES_USD } from "@/lib/subscription";

const DEFAULT_PLANS = [
  { key: PlanTier.STARTER, name: "Starter", priceUsd: PACKAGE_PRICES_USD.STARTER, pricePkr: 0, features: ["POS & invoices", "Bulk stock", "Brands & categories", "1 owner login"], isActive: true },
  { key: PlanTier.PRO, name: "Growth", priceUsd: PACKAGE_PRICES_USD.PRO, pricePkr: 0, features: ["Everything in Starter", "Serial/IMEI, batch & barcode", "Supplier ledger & analytics", "Staff logins"], isActive: true },
  { key: PlanTier.MARKETING_AGENCY, name: "Marketing Agency", priceUsd: PACKAGE_PRICES_USD.MARKETING_AGENCY, pricePkr: 0, features: ["Everything in Growth", "Service jobs & installments", "Offline sync", "Unlimited staff & units"], isActive: true },
  { key: PlanTier.ENTERPRISE, name: "Legacy", priceUsd: PACKAGE_PRICES_USD.MARKETING_AGENCY, pricePkr: 0, features: ["Legacy tier"], isActive: false },
];

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let plans = await prisma.subscriptionPlan.findMany({ orderBy: { priceUsd: "asc" } }).catch(() => [] as any[]);
  if (plans.length === 0) {
    await prisma.subscriptionPlan.createMany({ data: DEFAULT_PLANS as any, skipDuplicates: true }).catch(() => {});
    plans = await prisma.subscriptionPlan.findMany({ orderBy: { priceUsd: "asc" } }).catch(() => [] as any[]);
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
        subscriptionPaidUntil: true, lastPaidAt: true, email: true, phone: true, subscriptionTier: true, billingMode: true,
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
    const paid = isRealActive || paidWindowValid;
    const packageUsd = (PACKAGE_PRICES_USD as any)[String(t.subscriptionTier || "STARTER")] ?? PACKAGE_PRICES_USD.STARTER;
    return {
      ...t,
      paid,
      paidWindowValid,
      voucherPaid: countsByTenant[t.id]?.paid ?? 0,
      voucherUnpaid: countsByTenant[t.id]?.unpaid ?? 0,
      packageUsd,
    };
  });

  const activePaid = businesses.filter((b: any) => b.paid).length;
  const realActive = businesses.filter((b: any) => String(b.accountType) === "REAL" && String(b.status) === "ACTIVE").length;
  const mrr = businesses.filter((b: any) => b.paid).reduce((sum: number, b: any) => sum + (b.packageUsd || 0), 0);

  return NextResponse.json({
    package: { name: "Subscription packages (USD)", periodDays: 35, rule: "1 voucher = 35 days; N vouchers paid together = N*30+5 days. Auto-locks on expiry (data preserved). Trial: 7 days full access." },
    plans: plans.filter((p: any) => p.isActive !== false || ["STARTER","PRO","MARKETING_AGENCY"].includes(String(p.key))),
    businesses,
    metrics: { mrr, activePaid, realActive, businesses: businesses.length },
    subscriptions: [],
    invoices: [],
  });
}
