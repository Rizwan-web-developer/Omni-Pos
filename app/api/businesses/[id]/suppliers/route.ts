import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";
import { assertTenantWritable } from "@/lib/trial-guard";
import { loadSuppliers, serializeSupplier } from "@/lib/suppliers";

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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  const suppliers = await loadSuppliers(params.id);
  return NextResponse.json({ suppliers });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim().slice(0, 120);
    if (name.length < 2) return NextResponse.json({ message: "Supplier name is required." }, { status: 400 });

    const existing = await prisma.supplier.findFirst({ where: { tenantId: params.id, name }, select: { id: true } });
    if (existing) return NextResponse.json({ message: "A supplier with this name already exists." }, { status: 409 });

    const supplier = await prisma.supplier.create({
      data: {
        tenantId: params.id,
        name,
        phone: String(body?.phone ?? "").trim().slice(0, 40) || null,
        address: String(body?.address ?? "").trim().slice(0, 200) || null,
        notes: String(body?.notes ?? "").trim().slice(0, 300) || null,
        imageUrl: typeof body?.imageUrl === "string" && body.imageUrl ? body.imageUrl : null,
      },
      include: { entries: true, products: true },
    });
    return NextResponse.json({ supplier: serializeSupplier(supplier) }, { status: 201 });
  } catch (error) {
    console.error("Create supplier error:", error);
    return NextResponse.json({ message: "Failed to create supplier." }, { status: 500 });
  }
}
