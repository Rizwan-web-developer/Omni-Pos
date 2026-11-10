import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const baseSelect = {
    id: true, uid: true, businessName: true, slug: true, industryType: true, status: true, accountType: true,
    email: true, phone: true, location: true, subscriptionPaidUntil: true, lastPaidAt: true,
  } as any;
  let business: any = null;
  try {
    business = await prisma.tenant.findUnique({ where: { id: params.id }, select: { ...baseSelect, logoDataUrl: true } });
  } catch {
    business = await prisma.tenant.findUnique({ where: { id: params.id }, select: baseSelect });
  }
  if (!business) return NextResponse.json({ message: "Not found." }, { status: 404 });
  return NextResponse.json({ business, role: access.session.role });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    // Shop can manage profile (NOT email)
    if (typeof body.businessName === "string" && body.businessName.trim().length >= 2) data.businessName = body.businessName.trim().slice(0, 120);
    if (typeof body.phone === "string") data.phone = body.phone.trim().slice(0, 40) || null;
    if (typeof body.location === "string") data.location = body.location.trim().slice(0, 200) || null;
    if (body.logoDataUrl !== undefined) {
      const logo = typeof body.logoDataUrl === "string" ? body.logoDataUrl : "";
      // allow clearing, or cap size (~2MB data URL)
      if (logo && logo.length > 2_800_000) return NextResponse.json({ message: "Logo image is too large. Use a smaller image." }, { status: 400 });
      data.logoDataUrl = logo || null;
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No valid changes provided." }, { status: 400 });

    let business: any = null;
    const outBase = { id: true, uid: true, businessName: true, email: true, phone: true, location: true } as any;
    try {
      business = await prisma.tenant.update({ where: { id: params.id }, data: data as any, select: { ...outBase, logoDataUrl: true } });
    } catch {
      // fallback: persist without logoDataUrl if client type stale, then read base
      const { logoDataUrl, ...rest } = data as any;
      await prisma.tenant.update({ where: { id: params.id }, data: rest as any });
      if (logoDataUrl !== undefined) {
        await prisma.$executeRaw`UPDATE "Tenant" SET "logoDataUrl" = ${logoDataUrl} WHERE "id" = ${params.id}`.catch(() => {});
      }
      try {
        business = await prisma.tenant.findUnique({ where: { id: params.id }, select: { ...outBase, logoDataUrl: true } });
      } catch {
        business = await prisma.tenant.findUnique({ where: { id: params.id }, select: outBase });
      }
    }
    return NextResponse.json({ business });
  } catch (error) {
    console.error("Shop profile update error:", error);
    return NextResponse.json({ message: "Failed to update profile." }, { status: 500 });
  }
}
