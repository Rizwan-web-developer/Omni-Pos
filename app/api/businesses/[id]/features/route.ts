import { NextResponse } from "next/server";

import { requireTenantAccess } from "@/lib/auth/server";
import { FEATURES, FEATURE_GROUPS, CORE_FEATURES } from "@/lib/features";
import { getTenantFeatureKeys } from "@/lib/tenant-features";

export const dynamic = "force-dynamic";

/**
 * Feature access for a shop panel. Reads the admin-granted checkboxes.
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const features = await getTenantFeatureKeys(params.id);
  return NextResponse.json({
    features,
    catalog: FEATURES.filter((feature) => features.includes(feature.key)),
    groups: FEATURE_GROUPS,
    core: CORE_FEATURES,
  });
}
