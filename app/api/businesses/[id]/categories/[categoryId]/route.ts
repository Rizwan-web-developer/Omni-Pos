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

export async function GET(_req: Request, { params }: { params: { id: string; categoryId: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const category = await (prisma as any).category.findFirst({
    where: { id: params.categoryId, tenantId: params.id },
    include: { _count: { select: { products: true } } },
  });
  if (!category) return NextResponse.json({ message: "Category not found." }, { status: 404 });

  const products = await (prisma as any).product.findMany({
    where: { tenantId: params.id, categoryId: params.categoryId, deletedAt: null },
    orderBy: { updatedAt: "desc" },
    include: {
      brandRef: { select: { id: true, name: true } },
      serialItems: { where: { isSold: false }, orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({ category, products: products.map(serializeProduct) });
}

export async function PATCH(req: Request, { params }: { params: { id: string; categoryId: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    if (name.length < 2) return NextResponse.json({ message: "Category name is required." }, { status: 400 });
    const existing = await (prisma as any).category.findFirst({ where: { id: params.categoryId, tenantId: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Category not found." }, { status: 404 });
    const dup = await (prisma as any).category.findFirst({
      where: { tenantId: params.id, name: { equals: name, mode: "insensitive" }, NOT: { id: params.categoryId } },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ message: "This category already exists." }, { status: 409 });
    const category = await prisma.$transaction(async (tx: any) => {
      const updated = await tx.category.update({
        where: { id: params.categoryId },
        data: { name },
        include: { _count: { select: { products: true } } },
      });
      await tx.product.updateMany({ where: { tenantId: params.id, categoryId: params.categoryId }, data: { category: name } });
      return updated;
    });
    return NextResponse.json({ category });
  } catch (e) {
    console.error("Update category error:", e);
    return NextResponse.json({ message: "Failed to update category." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; categoryId: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;
  try {
    const existing = await (prisma as any).category.findFirst({ where: { id: params.categoryId, tenantId: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Category not found." }, { status: 404 });
    await (prisma as any).category.delete({ where: { id: params.categoryId } }); // Product.categoryId -> SetNull
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Delete category error:", e);
    return NextResponse.json({ message: "Failed to delete category." }, { status: 500 });
  }
}
