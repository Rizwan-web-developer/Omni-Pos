import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { hashPassword, isPlatformAdmin, requireTenantAccess, validatePassword } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";
import { assertTenantWritable } from "@/lib/trial-guard";

const STAFF_ROLES = new Set(["MANAGER", "CASHIER"]);

function serializeStaff(user: any) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt };
}

async function guard(id: string, sessionRole: string, adminBypass = false) {
  if (!isPlatformAdmin(sessionRole) && sessionRole !== "OWNER") {
    return NextResponse.json({ message: "Only the shop owner can manage staff accounts." }, { status: 403 });
  }
  const blocked = await assertTenantWritable(id, { adminBypass });
  if (blocked) return blocked;
  if (!(await tenantHasFeature(id, "MULTI_USER"))) {
    return NextResponse.json({ message: "Staff accounts are not enabled for this business." }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: { id: string; staffId: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await guard(params.id, access.session.role, access.admin);
  if (blocked) return blocked;

  try {
    const existing = await prisma.user.findFirst({ where: { id: params.staffId, tenantId: params.id }, select: { id: true, role: true } });
    if (!existing) return NextResponse.json({ message: "Staff account not found." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body?.name === "string" && body.name.trim().length >= 2) data.name = body.name.trim().slice(0, 100);
    if (typeof body?.role === "string") {
      const role = String(body.role).toUpperCase();
      if (!STAFF_ROLES.has(role)) return NextResponse.json({ message: "Invalid staff role." }, { status: 400 });
      data.role = role;
    }
    if (typeof body?.isActive === "boolean") data.isActive = body.isActive;
    if (typeof body?.password === "string" && body.password.length > 0) {
      const pwError = validatePassword(body.password);
      if (pwError) return NextResponse.json({ message: pwError }, { status: 400 });
      data.passwordHash = hashPassword(body.password);
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No valid changes." }, { status: 400 });
    const user = await prisma.user.update({
      where: { id: params.staffId },
      data: data as any,
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    return NextResponse.json({ staff: serializeStaff(user) });
  } catch (error) {
    console.error("Update staff error:", error);
    return NextResponse.json({ message: "Failed to update staff account." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; staffId: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await guard(params.id, access.session.role, access.admin);
  if (blocked) return blocked;

  try {
    const existing = await prisma.user.findFirst({ where: { id: params.staffId, tenantId: params.id }, select: { id: true, role: true } });
    if (!existing) return NextResponse.json({ message: "Staff account not found." }, { status: 404 });
    if (existing.role === "OWNER") return NextResponse.json({ message: "The shop owner account cannot be deleted." }, { status: 400 });

    await prisma.user.delete({ where: { id: params.staffId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete staff error:", error);
    return NextResponse.json({ message: "Failed to delete staff account." }, { status: 500 });
  }
}
