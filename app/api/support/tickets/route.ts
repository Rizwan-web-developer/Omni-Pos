import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, isPlatformAdmin, requirePlatformAdmin } from "@/lib/auth/server";
import { TicketPriority, TicketStatus } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const summary = searchParams.get("summary") === "1";

  if (isPlatformAdmin(session.role)) {
    if (summary) {
      const openCount = await prisma.supportTicket.count({ where: { status: "OPEN" as any } });
      return NextResponse.json({ openCount });
    }
    const tickets = await prisma.supportTicket.findMany({
      include: { tenant: { select: { businessName: true, uid: true } } },
      orderBy: { createdAt: "desc" },
      take: 150,
    });
    return NextResponse.json({ tickets });
  }

  // Shop/tenant user: only their own tickets
  if (!session.tenantId) return NextResponse.json({ tickets: [] });
  const tickets = await prisma.supportTicket.findMany({
    where: { tenantId: session.tenantId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ tickets });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const subject = String(body?.subject ?? "").trim();
  const message = String(body?.message ?? "").trim();
  if (!subject || !message) return NextResponse.json({ error: "subject and message required" }, { status: 400 });

  const admin = isPlatformAdmin(session.role);
  const tenantId = admin ? (body?.tenantId || session.tenantId || null) : (session.tenantId || null);

  const ticket = await prisma.supportTicket.create({
    data: {
      subject,
      message,
      requester: String(body?.requester ?? session.name ?? ""),
      email: String(body?.email ?? session.email ?? ""),
      priority: (body?.priority as TicketPriority) || TicketPriority.MEDIUM,
      status: TicketStatus.OPEN,
      tenantId,
    },
  });
  return NextResponse.json({ ticket }, { status: 201 });
}

export async function PATCH(req: Request) {
  // Status/priority updates: admin only
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const { id, status, priority } = body as { id?: string; status?: TicketStatus; priority?: TicketPriority };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ticket = await prisma.supportTicket.update({
    where: { id },
    data: { ...(status ? { status } : {}), ...(priority ? { priority } : {}) },
  });
  return NextResponse.json({ ticket });
}
