import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";
import { assertTenantWritable } from "@/lib/trial-guard";
import { productSalesStats, serializeSupplier } from "@/lib/suppliers";

async function guard(id: string) {
  const access = await requireTenantAccess(id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(id, { adminBypass: access.admin });
  if (blocked) return blocked;
  if (!(await tenantHasFeature(id, "SUPPLIER_LEDGER"))) {
    return NextResponse.json({ message: "Supplier ledger is not enabled for this business." }, { status: 403 });
  }
  return null;
}

async function supplierWithStats(id: string, supplierId: string) {
  const supplier: any = await (prisma as any).supplier.findFirst({
    where: { id: supplierId, tenantId: id },
    include: {
      entries: { orderBy: { createdAt: "desc" } },
      products: { where: { deletedAt: null }, orderBy: { name: "asc" } },
    },
  });
  if (!supplier) return null;
  const stats = await productSalesStats(id, (supplier.products ?? []).map((p: any) => p.id));
  return serializeSupplier(supplier, stats);
}

export async function GET(_req: Request, { params }: { params: { id: string; supplierId: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  const supplier = await supplierWithStats(params.id, params.supplierId);
  if (!supplier) return NextResponse.json({ message: "Supplier not found." }, { status: 404 });
  return NextResponse.json({ supplier });
}

export async function PATCH(req: Request, { params }: { params: { id: string; supplierId: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  try {
    const existing = await prisma.supplier.findFirst({ where: { id: params.supplierId, tenantId: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Supplier not found." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body?.name === "string" && body.name.trim().length >= 2) data.name = body.name.trim().slice(0, 120);
    if (typeof body?.phone === "string") data.phone = body.phone.trim().slice(0, 40) || null;
    if (typeof body?.address === "string") data.address = body.address.trim().slice(0, 200) || null;
    if (typeof body?.notes === "string") data.notes = body.notes.trim().slice(0, 300) || null;
    if (body?.imageUrl === null) data.imageUrl = null;
    else if (typeof body?.imageUrl === "string") data.imageUrl = body.imageUrl || null;

    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No valid changes." }, { status: 400 });
    await prisma.supplier.update({ where: { id: params.supplierId }, data: data as any });

    const supplier = await supplierWithStats(params.id, params.supplierId);
    return NextResponse.json({ supplier });
  } catch (error) {
    console.error("Update supplier error:", error);
    return NextResponse.json({ message: "Failed to update supplier." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; supplierId: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  try {
    const existing = await prisma.supplier.findFirst({ where: { id: params.supplierId, tenantId: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Supplier not found." }, { status: 404 });
    // Products stay in inventory; their supplier link is cleared automatically
    // (onDelete: SetNull on Product.supplierId).
    await prisma.supplier.delete({ where: { id: params.supplierId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete supplier error:", error);
    return NextResponse.json({ message: "Failed to delete supplier." }, { status: 500 });
  }
}
