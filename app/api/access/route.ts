import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/server";
import { CORE_FEATURES, FEATURES, FEATURE_GROUPS, INDUSTRY_FEATURES, isFeatureKey } from "@/lib/features";
import { getTenantFeatureKeys, setTenantFeatures } from "@/lib/tenant-features";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const businesses = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      uid: true,
      businessName: true,
      industryType: true,
      status: true,
      accountType: true,
      subscriptionTier: true,
      features: { select: { key: true } },
    },
  });

  return NextResponse.json({
    businesses: businesses.map((business: { features: Array<{ key: string }> }) => ({
      ...business,
      features: business.features.map((feature: { key: string }) => feature.key),
    })),
    catalog: FEATURES,
    core: CORE_FEATURES,
    groups: FEATURE_GROUPS,
    industryRecommendations: INDUSTRY_FEATURES,
  });
}

export async function PUT(req: Request) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as {
      tenantId?: unknown;
      features?: unknown;
    };
    const tenantId = String(body?.tenantId ?? "").trim();
    if (!tenantId) return NextResponse.json({ message: "Business is required." }, { status: 400 });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) return NextResponse.json({ message: "Business not found." }, { status: 404 });

    let requested: string[] = [];
    if (Array.isArray(body?.features)) {
      requested = (body.features as unknown[]).map((value) => String(value)).filter(isFeatureKey);
    } else if (body?.features && typeof body.features === "object") {
      requested = Object.entries(body.features as Record<string, unknown>)
        .filter(([key, enabled]) => Boolean(enabled) && isFeatureKey(key))
        .map(([key]) => key);
    } else {
      return NextResponse.json({ message: "Features list is required." }, { status: 400 });
    }

    const features = await setTenantFeatures(tenantId, requested);
    return NextResponse.json({ features });
  } catch (error) {
    console.error("Access update error:", error);
    return NextResponse.json({ message: "Failed to update access." }, { status: 500 });
  }
}
