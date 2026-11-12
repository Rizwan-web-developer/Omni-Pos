import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requireTenantAccess, verifyPassword } from "@/lib/auth/server";
import { assertTenantWritable } from "@/lib/trial-guard";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;

  // Admins use the admin reset-password flow; this endpoint is for the logged-in shop user
  if (access.admin) return NextResponse.json({ message: "Admins: use Reset Password from the admin panel for this business." }, { status: 400 });

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");

    if (!currentPassword || !newPassword) return NextResponse.json({ message: "Current and new password are required." }, { status: 400 });
    if (newPassword.length < 8) return NextResponse.json({ message: "New password must be at least 8 characters." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: access.session.sub }, select: { id: true, passwordHash: true, tenantId: true, isActive: true } });
    if (!user || !user.isActive || user.tenantId !== params.id) return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    if (!verifyPassword(currentPassword, user.passwordHash)) return NextResponse.json({ message: "Current password is incorrect." }, { status: 400 });

    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(newPassword) } });
    return NextResponse.json({ ok: true, message: "Password updated." });
  } catch (error) {
    console.error("Change password error:", error);
    return NextResponse.json({ message: "Failed to change password." }, { status: 500 });
  }
}
