import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/server";
import { IndustryType } from "@prisma/client";

const DEFAULTS: Array<{ industryType: IndustryType; displayName: string; description: string; features: Record<string, boolean> }> = [
  { industryType: "MOBILE_ACCESSORIES", displayName: "Mobile Accessories & Gadgets", description: "IMEI/serial, warranty, device sales.", features: { imeiTracking: true, serialTracking: true, warranty: true, expiryBatchTracking: false } },
  { industryType: "PHARMACY", displayName: "Pharmacy & Medical", description: "Batches, expiry, regulated dispensing.", features: { imeiTracking: false, expiryBatchTracking: true, fefo: true, prescriptionFlag: true } },
  { industryType: "GROCERY", displayName: "Grocery & Supermart", description: "Fast barcode, stock, categories.", features: { barcodeFastCheckout: true, stockAlerts: true, expiryBatchTracking: false } },
  { industryType: "ELECTRONICS", displayName: "Electronics Shop", description: "Serials, warranty, installments.", features: { serialTracking: true, warranty: true, installments: true } },
  { industryType: "HARDWARE_SHOP", displayName: "Hardware Shop", description: "Units, bulk, measurements.", features: { unitMeasurement: true, bulkItems: true, stockAlerts: true } },
  { industryType: "PAINT_SHOP", displayName: "Paint Shop", description: "Shades, formulas, containers.", features: { shadeFormulas: true, containerVariants: true, customMix: true } },
  { industryType: "COSMETICS_SHOP", displayName: "Cosmetics Shop", description: "Variants, shades, batches.", features: { variantsShades: true, expiryBatchTracking: true, barcodeFastCheckout: true } },
];

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let modules = await prisma.industryModuleConfig.findMany({ orderBy: { displayName: "asc" } });
  if (modules.length === 0) {
    await prisma.industryModuleConfig.createMany({
      data: DEFAULTS.map((d) => ({ ...d, features: d.features })),
      skipDuplicates: true,
    });
    modules = await prisma.industryModuleConfig.findMany({ orderBy: { displayName: "asc" } });
  }
  return NextResponse.json({ modules });
}

export async function PATCH(req: Request) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { id, enabled, features } = body as { id?: string; enabled?: boolean; features?: Record<string, boolean> };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const updated = await prisma.industryModuleConfig.update({
    where: { id },
    data: { ...(typeof enabled === "boolean" ? { enabled } : {}), ...(features ? { features } : {}) },
  });
  return NextResponse.json({ module: updated });
}
