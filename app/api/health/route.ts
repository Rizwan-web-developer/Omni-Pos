import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/server";

export async function GET() {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [tenants, logs] = await Promise.all([
    prisma.tenant.findMany({
      select: { id: true, uid: true, businessName: true, status: true, industryType: true, updatedAt: true, terminals: true, location: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    prisma.syncHealthLog.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { tenant: { select: { businessName: true } } } }),
  ]);

  const status = tenants.map((t: (typeof tenants)[number]) => ({
    ...t,
    syncState: t.status === "DEACTIVE" ? "LOCKED" : "SYNCED",
    pendingQueue: 0,
    lastHeartbeat: t.updatedAt,
  }));

  return NextResponse.json({
    summary: {
      businesses: tenants.length,
      synced: status.filter((s: (typeof status)[number]) => s.syncState === "SYNCED").length,
      pending: status.filter((s: (typeof status)[number]) => s.syncState !== "SYNCED").length,
      totalPendingQueue: status.reduce((a: number, s: (typeof status)[number]) => a + s.pendingQueue, 0),
    },
    status,
    logs,
  });
}
