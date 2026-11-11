import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";

function serializeSupplier(supplier: any) {
  const opening = Number(supplier.openingBalancePkr ?? 0);
  const entries = (supplier.entries ?? []).map((e: any) => ({
    ...e,
    amountPkr: Number(e.amountPkr ?? 0),
  }));
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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  const suppliers = await prisma.supplier.findMany({
    where: { tenantId: params.id },
    orderBy: { name: "asc" },
    include: { entries: { orderBy: { createdAt: "desc" }, take: 100 } },
  });
  return NextResponse.json({ suppliers: suppliers.map(serializeSupplier) });
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
        openingBalancePkr: Math.max(0, Number(body?.openingBalancePkr ?? 0) || 0),
      },
      include: { entries: true },
    });
    return NextResponse.json({ supplier: serializeSupplier(supplier) }, { status: 201 });
  } catch (error) {
    console.error("Create supplier error:", error);
    return NextResponse.json({ message: "Failed to create supplier." }, { status: 500 });
  }
}
