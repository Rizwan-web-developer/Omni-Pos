import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/server";

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const announcements = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({ announcements });
}

export async function POST(req: Request) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const msg = String(body?.body ?? "").trim();
  if (!title || !msg) return NextResponse.json({ error: "title and body required" }, { status: 400 });
  const a = await prisma.announcement.create({
    data: { title, body: msg, audience: String(body?.audience ?? "all"), createdBy: session.name, publishedAt: body?.publish ? new Date() : null },
  });
  return NextResponse.json({ announcement: a }, { status: 201 });
}
