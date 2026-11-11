import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { hashPassword, isPlatformAdmin, normalizeEmail, requireTenantAccess, validatePassword } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";

const STAFF_ROLES = new Set(["MANAGER", "CASHIER"]);

function serializeStaff(user: any) {
  return { id: user.id, name: user.name, email: user.email, role: user.role, isActive: user.isActive, lastLoginAt: user.lastLoginAt, createdAt: user.createdAt };
}

async function guard(id: string, sessionRole: string) {
  if (!isPlatformAdmin(sessionRole) && sessionRole !== "OWNER") {
    return NextResponse.json({ message: "Only the shop owner can manage staff accounts." }, { status: 403 });
  }
  if (!(await tenantHasFeature(id, "MULTI_USER"))) {
    return NextResponse.json({ message: "Staff accounts are not enabled for this business." }, { status: 403 });
  }
  return null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await guard(params.id, access.session.role);
  if (blocked) return blocked;

  const staff = await prisma.user.findMany({
    where: { tenantId: params.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });
  return NextResponse.json({ staff: staff.map(serializeStaff) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await guard(params.id, access.session.role);
  if (blocked) return blocked;

  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body?.name ?? "").trim().slice(0, 100);
    const email = normalizeEmail(String(body?.email ?? ""));
    const password = String(body?.password ?? "");
    const roleRaw = String(body?.role ?? "CASHIER").toUpperCase();
    const role = STAFF_ROLES.has(roleRaw) ? roleRaw : "CASHIER";

    if (name.length < 2) return NextResponse.json({ message: "Staff name is required." }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ message: "A valid email is required." }, { status: 400 });
    const pwError = validatePassword(password);
    if (pwError) return NextResponse.json({ message: pwError }, { status: 400 });

    const conflict = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (conflict) return NextResponse.json({ message: "This email is already registered." }, { status: 409 });

    const user = await prisma.user.create({
      data: { tenantId: params.id, name, email, passwordHash: hashPassword(password), role: role as any, isActive: true },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    return NextResponse.json({ staff: serializeStaff(user) }, { status: 201 });
  } catch (error) {
    console.error("Create staff error:", error);
    return NextResponse.json({ message: "Failed to create staff account." }, { status: 500 });
  }
}
