import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { assertTenantWritable } from "@/lib/trial-guard";

function serializeProduct(p: any) {
  return {
    ...p,
    costPrice: Number(p.costPrice),
    sellingPrice: Number(p.sellingPrice),
    serialItems: Array.isArray(p.serialItems)
      ? p.serialItems.map((s: any) => ({ id: s.id, serialOrImei: s.serialOrImei, isSold: s.isSold, warrantyDays: s.warrantyDays }))
      : undefined,
  };
}

export async function GET(_req: Request, { params }: { params: { id: string; brandId: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brand = await (prisma as any).brand.findFirst({
    where: { id: params.brandId, tenantId: params.id },
    include: { _count: { select: { products: true } } },
  });
  if (!brand) return NextResponse.json({ message: "Brand not found." }, { status: 404 });

  const products = await (prisma as any).product.findMany({
    where: { tenantId: params.id, brandId: params.brandId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: { serialItems: { where: { isSold: false }, orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({ brand, products: products.map(serializeProduct) });
}

export async function PATCH(req: Request, { params }: { params: { id: string; brandId: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    if (name.length < 2) return NextResponse.json({ message: "Brand name is required." }, { status: 400 });
    const existing = await (prisma as any).brand.findFirst({ where: { id: params.brandId, tenantId: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Brand not found." }, { status: 404 });
    const dup = await (prisma as any).brand.findFirst({
      where: { tenantId: params.id, name: { equals: name, mode: "insensitive" }, NOT: { id: params.brandId } },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ message: "This brand already exists." }, { status: 409 });
    const data: Record<string, unknown> = { name };
    if (Object.prototype.hasOwnProperty.call(body, "imageUrl")) {
      data.imageUrl = typeof body.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
    }
    const brand = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.brand.update({
        where: { id: params.brandId },
        data,
        include: { _count: { select: { products: true } } },
      });
      // keep product snapshot names in sync
      await tx.product.updateMany({ where: { tenantId: params.id, brandId: params.brandId }, data: { brand: name } });
      return updated;
    });
    return NextResponse.json({ brand });
  } catch (e) {
    console.error("Update brand error:", e);
    return NextResponse.json({ message: "Failed to update brand." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; brandId: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;
  try {
    const existing = await (prisma as any).brand.findFirst({ where: { id: params.brandId, tenantId: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Brand not found." }, { status: 404 });
    await (prisma as any).brand.delete({ where: { id: params.brandId } }); // Product.brandId -> SetNull
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete brand error:", e);
    return NextResponse.json({ message: "Failed to delete brand." }, { status: 500 });
  }
}
