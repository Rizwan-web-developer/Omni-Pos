import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { getTenantFlags, tenantHasFeature } from "@/lib/tenant-features";
import { buildFeatureProductFields, serializeFeatureProductFields } from "@/lib/product-options";
import { assertTenantWritable } from "@/lib/trial-guard";

function serializeProduct(p: any) {
  return {
    id: p.id,
    tenantId: p.tenantId,
    name: p.name,
    sku: p.sku ?? null,
    barcode: p.barcode ?? null,
    category: p.category ?? "",
    categoryId: p.categoryId ?? null,
    brand: p.brand ?? null,
    brandId: p.brandId ?? null,
    imageUrl: p.imageUrl ?? null,
    trackingType: p.trackingType ?? "QUANTITY_ONLY",
    costPrice: Number(p.costPrice),
    sellingPrice: Number(p.sellingPrice),
    stockQuantity: p.stockQuantity,
    minStockAlert: p.minStockAlert,
    isActive: p.isActive !== false,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    ...serializeFeatureProductFields(p),
    // Include available (unsold) serials for serialized products (used by POS selection)
    serialItems: Array.isArray(p.serialItems)
      ? p.serialItems.map((s: any) => ({
          id: s.id,
          serialOrImei: s.serialOrImei,
          isSold: s.isSold,
          warrantyDays: s.warrantyDays,
        }))
      : undefined,
  };
}

function parseSerials(input: unknown): string[] {
  const raw = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\n,;\s]+/)
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    // Basic sanity: IMEI/serial tags (alnum, dash) reasonable length
    if (s.length < 4 || s.length > 40) continue;
    if (!/^[A-Za-z0-9\-]+$/.test(s)) continue;
    const key = s.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await prisma.tenant.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!tenant) return NextResponse.json({ message: "Business not found." }, { status: 404 });

  const serialEnabled = await tenantHasFeature(params.id, "SERIAL_IMEI");
  const flags = await getTenantFlags(params.id);

  const products = await (prisma as any).product.findMany({
    where: { tenantId: params.id, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { serialItems: { where: { isSold: false }, orderBy: { createdAt: "asc" } } },
  });
  return NextResponse.json({
    products: products.map((product: any) => {
      const serialized = serializeProduct(product);
      if (!serialEnabled) serialized.serialItems = undefined;
      return serialized;
    }),
    features: {
      serialEnabled,
      batchExpiry: flags.BATCH_EXPIRY,
      prescription: flags.PRESCRIPTION,
      paintShade: flags.PAINT_SHADE,
      installments: flags.INSTALLMENTS,
      serviceJobs: flags.SERVICE_JOBS,
      barcodeFast: flags.BARCODE_FAST,
      multiUnit: flags.MULTI_UNIT,
      supplierLedger: flags.SUPPLIER_LEDGER,
      offlineSync: flags.OFFLINE_SYNC,
      advancedAnalytics: flags.ADVANCED_ANALYTICS,
      multiUser: flags.MULTI_USER,
      discounts: flags.DISCOUNTS,
      warranty: flags.WARRANTY,
    },
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => ({}));
    const tenant = await prisma.tenant.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!tenant) return NextResponse.json({ message: "Business not found." }, { status: 404 });

    const name = String(body?.name ?? "").trim();
    const sku = String(body?.sku ?? "").trim() || null;
    const barcode = String(body?.barcode ?? "").trim() || null;
    let category = String(body?.category ?? "").trim();
    const categoryIdRaw = typeof body?.categoryId === "string" ? body.categoryId.trim() : "";
    let categoryId: string | null = null;
    if (categoryIdRaw) {
      const c = await (prisma as any).category.findFirst({ where: { id: categoryIdRaw, tenantId: params.id }, select: { id: true, name: true } });
      if (!c) return NextResponse.json({ message: "Selected category not found." }, { status: 400 });
      categoryId = c.id;
      category = c.name; // snapshot
    }
    let brand = String(body?.brand ?? "").trim() || null;
    const brandIdRaw = typeof body?.brandId === "string" ? body.brandId.trim() : "";
    let brandId: string | null = null;
    if (brandIdRaw) {
      const b = await (prisma as any).brand.findFirst({ where: { id: brandIdRaw, tenantId: params.id }, select: { id: true, name: true } });
      if (!b) return NextResponse.json({ message: "Selected brand not found." }, { status: 400 });
      brandId = b.id;
      brand = b.name; // snapshot
    }
    const imageUrl = typeof body?.imageUrl === "string" && body.imageUrl ? body.imageUrl : null;
    const costPrice = Number(body?.costPrice ?? 0);
    const sellingPrice = Number(body?.sellingPrice ?? 0);
    const minStockAlert = Math.max(0, Math.floor(Number(body?.minStockAlert ?? 5)));
    const trackingType = String(body?.trackingType ?? "QUANTITY_ONLY") === "SERIAL_OR_IMEI" ? "SERIAL_OR_IMEI" : "QUANTITY_ONLY";
    const warrantyDays = Math.max(0, Math.floor(Number(body?.warrantyDays ?? 0)));

    if (name.length < 2) return NextResponse.json({ message: "Product name is required." }, { status: 400 });
    if (!Number.isFinite(sellingPrice) || sellingPrice < 0) return NextResponse.json({ message: "Valid selling price is required." }, { status: 400 });

    if (barcode) {
      const barcodeConflict = await (prisma as any).product.findFirst({
        where: { tenantId: params.id, barcode, deletedAt: null },
        select: { id: true, name: true },
      });
      if (barcodeConflict) {
        return NextResponse.json({ message: `Barcode already used by "${barcodeConflict.name}".` }, { status: 409 });
      }
    }

    const flags = await getTenantFlags(params.id);
    const featureFields = buildFeatureProductFields(body as Record<string, any>, flags);
    if (featureFields.error) return NextResponse.json({ message: featureFields.error }, { status: 400 });
    if (featureFields.data.expiryDate instanceof Date && (featureFields.data.expiryDate as Date).getTime() < Date.now()) {
      return NextResponse.json({ message: "Expiry date cannot be in the past." }, { status: 400 });
    }

    if (trackingType === "SERIAL_OR_IMEI") {
      const serialFeatureEnabled = await tenantHasFeature(params.id, "SERIAL_IMEI");
      if (!serialFeatureEnabled) {
        return NextResponse.json(
          { message: "IMEI/Serial tracking is not enabled for this business. Bulk quantity stock is available. Contact the platform admin to enable Access." },
          { status: 403 },
        );
      }
      const serials = parseSerials(body?.serials ?? body?.serialNumbers ?? body?.imeis ?? body?.serialOrImei);
      if (serials.length === 0) {
        return NextResponse.json({ message: "Add at least one valid Serial/IMEI for serialized tracking." }, { status: 400 });
      }
      // Check global uniqueness conflicts (serialOrImei is @unique)
      const conflicts = await (prisma as any).serialItem.findMany({
        where: { serialOrImei: { in: serials } },
        select: { serialOrImei: true },
      });
      if (conflicts.length > 0) {
        return NextResponse.json(
          { message: `These Serial/IMEI already exist: ${conflicts.map((c: any) => c.serialOrImei).slice(0, 5).join(", ")}` },
          { status: 409 },
        );
      }

      const product = await prisma.$transaction(async (tx: any) => {
        const created = await tx.product.create({
          data: {
            tenantId: params.id,
            name,
            sku,
            barcode,
            category,
            categoryId,
            brand,
            brandId,
            imageUrl,
            trackingType,
            costPrice: Number.isFinite(costPrice) && costPrice >= 0 ? costPrice : 0,
            sellingPrice,
            stockQuantity: serials.length, // available count = unsold serials
            minStockAlert,
            ...featureFields.data,
          },
        });
        await tx.serialItem.createMany({
          data: serials.map((serialOrImei) => ({
            tenantId: params.id,
            productId: created.id,
            serialOrImei,
            isSold: false,
            warrantyDays,
          })),
        });
        return tx.product.findUnique({
          where: { id: created.id },
          include: { serialItems: { where: { isSold: false }, orderBy: { createdAt: "asc" } } },
        });
      });
      return NextResponse.json({ product: serializeProduct(product) }, { status: 201 });
    }

    // QUANTITY_ONLY
    const stockQuantity = Math.max(0, Math.floor(Number(body?.stockQuantity ?? 0)));
    const product = await (prisma as any).product.create({
      data: {
        tenantId: params.id,
        name,
        sku,
        barcode,
        category,
        categoryId,
        brand,
        brandId,
        imageUrl,
        trackingType: "QUANTITY_ONLY",
        costPrice: Number.isFinite(costPrice) && costPrice >= 0 ? costPrice : 0,
        sellingPrice,
        stockQuantity,
        minStockAlert,
        ...featureFields.data,
      },
      include: { serialItems: { where: { isSold: false } } },
    });
    return NextResponse.json({ product: serializeProduct(product) }, { status: 201 });
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ message: "Failed to add product." }, { status: 500 });
  }
}
