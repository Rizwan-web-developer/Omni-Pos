import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";

function serializeSupplier(supplier: any) {
  const opening = Number(supplier.openingBalancePkr ?? 0);
  const entries = (supplier.entries ?? []).map((e: any) => ({ ...e, amountPkr: Number(e.amountPkr ?? 0) }));
  const purchases = entries.filter((e: any) => e.type === "PURCHASE").reduce((s: number, e: any) => s + e.amountPkr, 0);
  const payments = entries.filter((e: any) => e.type === "PAYMENT").reduce((s: number, e: any) => s + e.amountPkr, 0);
  return {
    ...supplier,
    openingBalancePkr: opening,
    entries,
    purchasesPkr: purchases,
    paymentsPkr: payments,
    balancePkr: Math.round((opening + purchases - payments) * 100) / 100,
  };
}

async function guard(id: string) {
  const access = await requireTenantAccess(id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await tenantHasFeature(id, "SUPPLIER_LEDGER"))) {
    return NextResponse.json({ message: "Supplier ledger is not enabled for this business." }, { status: 403 });
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: { id: string; supplierId: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  const supplier = await prisma.supplier.findFirst({
    where: { id: params.supplierId, tenantId: params.id },
    include: { entries: { orderBy: { createdAt: "desc" } } },
  });
  if (!supplier) return NextResponse.json({ message: "Supplier not found." }, { status: 404 });
  return NextResponse.json({ supplier: serializeSupplier(supplier) });
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
    if (body?.openingBalancePkr !== undefined && Number.isFinite(Number(body.openingBalancePkr))) {
      data.openingBalancePkr = Math.max(0, Number(body.openingBalancePkr));
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No valid changes." }, { status: 400 });
    const supplier = await prisma.supplier.update({
      where: { id: params.supplierId },
      data: data as any,
      include: { entries: { orderBy: { createdAt: "desc" } } },
    });
    return NextResponse.json({ supplier: serializeSupplier(supplier) });
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
    await prisma.supplier.delete({ where: { id: params.supplierId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete supplier error:", error);
    return NextResponse.json({ message: "Failed to delete supplier." }, { status: 500 });
  }
}
