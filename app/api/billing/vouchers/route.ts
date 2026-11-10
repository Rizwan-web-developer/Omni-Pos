import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/server";

export async function GET(req: Request) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId")?.trim();

  const where = tenantId ? { tenantId } : {};
  const vouchers = await prisma.subscriptionVoucher.findMany({
    where,
    orderBy: [{ year: "desc" }, { month: "asc" }],
    include: tenantId ? undefined : { tenant: { select: { id: true, businessName: true, uid: true } } },
    take: tenantId ? 200 : 500,
  });
  return NextResponse.json({ vouchers });
}
