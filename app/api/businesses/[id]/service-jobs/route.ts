import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";
import { assertTenantWritable } from "@/lib/trial-guard";

const STATUS_SET = new Set(["RECEIVED", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"]);

function serializeJob(job: any) {
  return { ...job, estimatePkr: Number(job.estimatePkr ?? 0) };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await tenantHasFeature(params.id, "SERVICE_JOBS"))) {
    return NextResponse.json({ message: "Service jobs are not enabled for this business." }, { status: 403 });
  }

  const jobs = await prisma.serviceJob.findMany({
    where: { tenantId: params.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ jobs: jobs.map(serializeJob) });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const access = await requireTenantAccess(params.id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(params.id, { adminBypass: access.admin });
  if (blocked) return blocked;
  if (!(await tenantHasFeature(params.id, "SERVICE_JOBS"))) {
    return NextResponse.json({ message: "Service jobs are not enabled for this business." }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const customerName = String(body?.customerName ?? "").trim().slice(0, 120);
    const device = String(body?.device ?? "").trim().slice(0, 120);
    const customerPhone = String(body?.customerPhone ?? "").trim().slice(0, 40) || null;
    const issue = String(body?.issue ?? "").trim().slice(0, 400) || null;
    const notes = String(body?.notes ?? "").trim().slice(0, 400) || null;
    const estimatePkr = Math.max(0, Number(body?.estimatePkr ?? 0) || 0);
    const statusRaw = String(body?.status ?? "RECEIVED").toUpperCase();
    const status = STATUS_SET.has(statusRaw) ? statusRaw : "RECEIVED";

    if (customerName.length < 2) return NextResponse.json({ message: "Customer name is required." }, { status: 400 });
    if (device.length < 2) return NextResponse.json({ message: "Device / item description is required." }, { status: 400 });

    const job = await prisma.serviceJob.create({
      data: {
        tenantId: params.id,
        jobNumber: `SRV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`,
        customerName,
        customerPhone,
        device,
        issue,
        notes,
        estimatePkr,
        status: status as any,
      },
    });
    return NextResponse.json({ job: serializeJob(job) }, { status: 201 });
  } catch (error) {
    console.error("Create service job error:", error);
    return NextResponse.json({ message: "Failed to create service job." }, { status: 500 });
  }
}
