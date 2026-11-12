import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";
import { assertTenantWritable } from "@/lib/trial-guard";

const TYPE_SET = new Set(["PURCHASE", "PAYMENT"]);

function serializeEntry(entry: any) {
  return { ...entry, amountPkr: Number(entry.amountPkr ?? 0) };
}

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

export async function POST(req: Request, { params }: { params: { id: string; supplierId: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  try {
    const supplier = await prisma.supplier.findFirst({ where: { id: params.supplierId, tenantId: params.id }, select: { id: true } });
    if (!supplier) return NextResponse.json({ message: "Supplier not found." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const typeRaw = String(body?.type ?? "PURCHASE").toUpperCase();
    if (!TYPE_SET.has(typeRaw)) return NextResponse.json({ message: "Invalid entry type." }, { status: 400 });
    const amount = Number(body?.amountPkr ?? 0);
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ message: "A valid amount is required." }, { status: 400 });

    const entry = await prisma.supplierEntry.create({
      data: {
        tenantId: params.id,
        supplierId: params.supplierId,
        type: typeRaw as any,
        amountPkr: amount,
        note: String(body?.note ?? "").trim().slice(0, 300) || null,
      },
    });
    return NextResponse.json({ entry: serializeEntry(entry) }, { status: 201 });
  } catch (error) {
    console.error("Create supplier entry error:", error);
    return NextResponse.json({ message: "Failed to add supplier entry." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string; supplierId: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  try {
    const url = new URL(req.url);
    const entryId = url.searchParams.get("entryId") ?? "";
    if (!entryId) return NextResponse.json({ message: "Entry id is required." }, { status: 400 });

    const entry = await prisma.supplierEntry.findFirst({ where: { id: entryId, supplierId: params.supplierId, tenantId: params.id }, select: { id: true } });
    if (!entry) return NextResponse.json({ message: "Entry not found." }, { status: 404 });
    await prisma.supplierEntry.delete({ where: { id: entryId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete supplier entry error:", error);
    return NextResponse.json({ message: "Failed to delete supplier entry." }, { status: 500 });
  }
}
