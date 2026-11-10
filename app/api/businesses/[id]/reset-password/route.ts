import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, requirePlatformAdmin } from "@/lib/auth/server";
import { generateTempPassword } from "@/lib/mappers";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = params.id;
    let userId = typeof body?.userId === "string" ? body.userId : null;

    if (!userId) {
      const owner = await prisma.user.findFirst({ where: { tenantId, role: "OWNER" }, select: { id: true } });
      userId = owner?.id ?? null;
    }
    if (!userId) return NextResponse.json({ message: "No business user found to reset." }, { status: 404 });

    // Security: only reset users that belong to this tenant (unless platform-level use case explicitly added)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, tenantId: true } });
    if (!user || user.tenantId !== tenantId) return NextResponse.json({ message: "User not found for this business." }, { status: 404 });

    const tempPassword = generateTempPassword(12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(tempPassword) } });

    return NextResponse.json({
      credentials: {
        email: user.email,
        temporaryPassword: tempPassword,
        note: "Password reset by Super Admin. Shown once.",
      },
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return NextResponse.json({ message: "Failed to reset password." }, { status: 500 });
  }
}
