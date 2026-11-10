import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isPlatformAdmin } from "@/lib/auth/server";

const DEFAULTS = { platformName: "OmniPos Hub", platformLogoDataUrl: null as string | null };

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const row = await (prisma as any).platformSetting.findUnique({ where: { id: "default" } });
    return NextResponse.json({
      platformName: row?.platformName || DEFAULTS.platformName,
      platformLogoDataUrl: row?.platformLogoDataUrl ?? null,
    });
  } catch {
    return NextResponse.json(DEFAULTS);
  }
}

export async function PUT(req: Request) {
  const session = await getSession();
  if (!session || !isPlatformAdmin(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const platformName =
    typeof body?.platformName === "string" && body.platformName.trim()
      ? body.platformName.trim().slice(0, 80)
      : DEFAULTS.platformName;
  const platformLogoDataUrl =
    typeof body?.platformLogoDataUrl === "string" && body.platformLogoDataUrl
      ? body.platformLogoDataUrl
      : null;
  try {
    const row = await (prisma as any).platformSetting.upsert({
      where: { id: "default" },
      update: { platformName, platformLogoDataUrl },
      create: { id: "default", platformName, platformLogoDataUrl },
      select: { platformName: true, platformLogoDataUrl: true },
    });
    return NextResponse.json({ platformName: row.platformName, platformLogoDataUrl: row.platformLogoDataUrl ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Could not save platform settings" }, { status: 500 });
  }
}
