import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { getTenantFlags } from "@/lib/tenant-features";
import { buildFeatureProductFields, serializeFeatureProductFields } from "@/lib/product-options";
import { assertTenantWritable } from "@/lib/trial-guard";

function serializeProduct(p: any) {
  return {
    ...p,
    costPrice: Number(p.costPrice),
    sellingPrice: Number(p.sellingPrice),
    ...serializeFeatureProductFields(p),
    serialItems: Array.isArray(p.serialItems)
      ? p.serialItems.map((s: any) => ({ id: s.id, serialOrImei: s.serialOrImei, isSold: s.isSold, warrantyDays: s.warrantyDays }))
      : undefined,
  };
}

function parseSerials(input: unknown): string[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? input.split(/[\n,;\s]+/) : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of raw) {
    const s = String(v ?? "").trim();
    if (!s || s.length < 4 || s.length > 40 || !/^[A-Za-z0-9\-]+$/.test(s)) continue;
    const key = s.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export async function PATCH(req: Request, { params }: { params: { id: string; productId: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => ({}));
    const existing = await (prisma as any).product.findFirst({
      where: { id: params.productId, tenantId: params.id, deletedAt: null },
      select: { id: true, tenantId: true, stockQuantity: true, trackingType: true },
    });
    if (!existing) return NextResponse.json({ message: "Product not found." }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim().length >= 2) data.name = body.name.trim();
    if (body.sku !== undefined) data.sku = String(body.sku ?? "").trim() || null;
    if (body.barcode !== undefined) data.barcode = String(body.barcode ?? "").trim() || null;
    if (body.categoryId !== undefined) {
      const raw = typeof body.categoryId === "string" ? body.categoryId.trim() : "";
      if (!raw) { data.categoryId = null; }
      else {
        const c = await (prisma as any).category.findFirst({ where: { id: raw, tenantId: params.id }, select: { id: true, name: true } });
        if (!c) return NextResponse.json({ message: "Selected category not found." }, { status: 400 });
        data.categoryId = c.id;
        data.category = c.name;
      }
    } else if (typeof body.category === "string") {
      data.category = body.category.trim();
    }
    if (body.brandId !== undefined) {
      const raw = typeof body.brandId === "string" ? body.brandId.trim() : "";
      if (!raw) { data.brandId = null; }
      else {
        const b = await (prisma as any).brand.findFirst({ where: { id: raw, tenantId: params.id }, select: { id: true, name: true } });
        if (!b) return NextResponse.json({ message: "Selected brand not found." }, { status: 400 });
        data.brandId = b.id;
        data.brand = b.name;
      }
    } else if (body.brand !== undefined) {
      data.brand = String(body.brand ?? "").trim() || null;
    }
    if (body.isActive !== undefined) data.isActive = Boolean(body.isActive);
    if (body.imageUrl !== undefined) data.imageUrl = typeof body.imageUrl === "string" && body.imageUrl ? body.imageUrl : null;
    if (body.costPrice !== undefined && Number.isFinite(Number(body.costPrice))) data.costPrice = Math.max(0, Number(body.costPrice));
    if (body.sellingPrice !== undefined && Number.isFinite(Number(body.sellingPrice))) data.sellingPrice = Math.max(0, Number(body.sellingPrice));
    if (body.minStockAlert !== undefined && Number.isFinite(Number(body.minStockAlert))) data.minStockAlert = Math.max(0, Math.floor(Number(body.minStockAlert)));

    const flags = await getTenantFlags(params.id);
    const featureFields = buildFeatureProductFields(body as Record<string, any>, flags);
    if (featureFields.error) return NextResponse.json({ message: featureFields.error }, { status: 400 });
    Object.assign(data, featureFields.data);

    const tracking = String(existing.trackingType ?? "QUANTITY_ONLY");

    // Add serials to an existing SERIAL_OR_IMEI product
    const addSerials = body.addSerials ?? body.serials;
    if (tracking === "SERIAL_OR_IMEI" && addSerials !== undefined) {
      const serials = parseSerials(addSerials);
      if (serials.length === 0) return NextResponse.json({ message: "No valid Serial/IMEI to add." }, { status: 400 });
      const warrantyDays = Math.max(0, Math.floor(Number(body?.warrantyDays ?? 0)));
      const conflicts = await (prisma as any).serialItem.findMany({ where: { serialOrImei: { in: serials } }, select: { serialOrImei: true } });
      if (conflicts.length > 0) {
        return NextResponse.json({ message: `These Serial/IMEI already exist: ${conflicts.map((c: any) => c.serialOrImei).slice(0, 5).join(", ")}` }, { status: 409 });
      }
      const product = await prisma.$transaction(async (tx: any) => {
        await tx.serialItem.createMany({ data: serials.map((serialOrImei) => ({ tenantId: params.id, productId: params.productId, serialOrImei, isSold: false, warrantyDays })) });
        const available = await tx.serialItem.count({ where: { productId: params.productId, isSold: false } });
        return tx.product.update({
          where: { id: params.productId },
          data: { ...data, stockQuantity: available } as any,
          include: { serialItems: { where: { isSold: false }, orderBy: { createdAt: "asc" } } },
        });
      });
      return NextResponse.json({ product: serializeProduct(product) });
    }

    // Stock management for QUANTITY_ONLY only
    if (tracking === "QUANTITY_ONLY") {
      if (body.stockQuantity !== undefined && Number.isFinite(Number(body.stockQuantity))) {
        data.stockQuantity = Math.max(0, Math.floor(Number(body.stockQuantity)));
      } else if (body.adjustStock !== undefined && Number.isFinite(Number(body.adjustStock))) {
        const delta = Math.floor(Number(body.adjustStock));
        data.stockQuantity = Math.max(0, existing.stockQuantity + delta);
      }
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No valid changes." }, { status: 400 });

    const product = await (prisma as any).product.update({
      where: { id: params.productId },
      data: data as any,
      include: { serialItems: { where: { isSold: false }, orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({ product: serializeProduct(product) });
  } catch (error) {
    console.error("Update product error:", error);
    return NextResponse.json({ message: "Failed to update product." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; productId: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;
  try {
    const existing = await (prisma as any).product.findFirst({
      where: { id: params.productId, tenantId: params.id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return NextResponse.json({ message: "Product not found." }, { status: 404 });
    // Soft-delete so products (even out of stock / referenced in sales history) can be removed from active lists safely.
    await (prisma as any).product.update({
      where: { id: params.productId },
      data: { deletedAt: new Date(), isActive: false },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete product error:", error);
    return NextResponse.json({ message: "Failed to delete product." }, { status: 500 });
  }
}
