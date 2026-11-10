import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tenant = await prisma.tenant.findUnique({ where: { id: params.id }, select: { id: true } });
  if (!tenant) return NextResponse.json({ message: "Business not found." }, { status: 404 });

  const invoices = await prisma.invoice.findMany({
    where: { tenantId: params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      items: {
        include: { product: { select: { name: true, brand: true, imageUrl: true, brandRef: { select: { name: true } } } } },
      },
    },
  });
  return NextResponse.json({
    invoices: invoices.map((inv: any) => ({
      ...inv,
      totalAmount: Number(inv.totalAmount),
      items: inv.items.map((it: any) => ({
        ...it,
        unitPrice: Number(it.unitPrice),
        lineTotal: Number(it.lineTotal),
        productName: it.productName ?? it.product?.name ?? null,
        brandName: it.brandName ?? it.product?.brandRef?.name ?? it.product?.brand ?? null,
        imageUrl: it.imageUrl ?? it.product?.imageUrl ?? null,
      })),
    })),
  });
}
