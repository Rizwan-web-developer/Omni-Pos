import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { assertTenantWritable } from "@/lib/trial-guard";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const brands = await (prisma as any).brand.findMany({
    where: { tenantId: params.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ brands });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    const imageUrl = typeof body?.imageUrl === "string" && body.imageUrl.trim() ? body.imageUrl.trim() : null;
    if (name.length < 2) return NextResponse.json({ message: "Brand name is required." }, { status: 400 });
    // Case-insensitive duplicate check per tenant
    const dup = await (prisma as any).brand.findFirst({
      where: { tenantId: params.id, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ message: "This brand already exists." }, { status: 409 });
    const brand = await (prisma as any).brand.create({
      data: { tenantId: params.id, name, imageUrl },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json({ brand }, { status: 201 });
  } catch (e) {
    console.error("Create brand error:", e);
    return NextResponse.json({ message: "Failed to add brand." }, { status: 500 });
  }
}
