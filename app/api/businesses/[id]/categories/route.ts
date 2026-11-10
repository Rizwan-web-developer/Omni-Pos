import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const categories = await (prisma as any).category.findMany({
    where: { tenantId: params.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ categories });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim();
    if (name.length < 2) return NextResponse.json({ message: "Category name is required." }, { status: 400 });
    const dup = await (prisma as any).category.findFirst({
      where: { tenantId: params.id, name: { equals: name, mode: "insensitive" } },
      select: { id: true },
    });
    if (dup) return NextResponse.json({ message: "This category already exists." }, { status: 409 });
    const category = await (prisma as any).category.create({
      data: { tenantId: params.id, name },
      include: { _count: { select: { products: true } } },
    });
    return NextResponse.json({ category }, { status: 201 });
  } catch (e) {
    console.error("Create category error:", e);
    return NextResponse.json({ message: "Failed to add category." }, { status: 500 });
  }
}
