import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { tenantHasFeature } from "@/lib/tenant-features";
import { assertTenantWritable } from "@/lib/trial-guard";

const STATUS_SET = new Set(["RECEIVED", "IN_PROGRESS", "READY", "DELIVERED", "CANCELLED"]);

function serializeJob(job: any) {
  return { ...job, estimatePkr: Number(job.estimatePkr ?? 0) };
}

async function guard(id: string) {
  const access = await requireTenantAccess(id);
  if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const blocked = await assertTenantWritable(id, { adminBypass: access.admin });
  if (blocked) return blocked;
  if (!(await tenantHasFeature(id, "SERVICE_JOBS"))) {
    return NextResponse.json({ message: "Service jobs are not enabled for this business." }, { status: 403 });
  }
  return null;
}

export async function PATCH(req: Request, { params }: { params: { id: string; jobId: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  try {
    const existing = await prisma.serviceJob.findFirst({ where: { id: params.jobId, tenantId: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Service job not found." }, { status: 404 });

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    if (typeof body?.customerName === "string" && body.customerName.trim().length >= 2) data.customerName = body.customerName.trim().slice(0, 120);
    if (typeof body?.customerPhone === "string") data.customerPhone = body.customerPhone.trim().slice(0, 40) || null;
    if (typeof body?.device === "string" && body.device.trim().length >= 2) data.device = body.device.trim().slice(0, 120);
    if (body?.issue !== undefined) data.issue = String(body.issue ?? "").trim().slice(0, 400) || null;
    if (body?.notes !== undefined) data.notes = String(body.notes ?? "").trim().slice(0, 400) || null;
    if (body?.estimatePkr !== undefined && Number.isFinite(Number(body.estimatePkr))) data.estimatePkr = Math.max(0, Number(body.estimatePkr));
    if (typeof body?.status === "string") {
      const status = String(body.status).toUpperCase();
      if (!STATUS_SET.has(status)) return NextResponse.json({ message: "Invalid service job status." }, { status: 400 });
      data.status = status;
      if (status === "DELIVERED") data.deliveredAt = new Date();
      if (status !== "DELIVERED") data.deliveredAt = null;
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ message: "No valid changes." }, { status: 400 });
    const job = await prisma.serviceJob.update({ where: { id: params.jobId }, data: data as any });
    return NextResponse.json({ job: serializeJob(job) });
  } catch (error) {
    console.error("Update service job error:", error);
    return NextResponse.json({ message: "Failed to update service job." }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string; jobId: string } }) {
  const blocked = await guard(params.id);
  if (blocked) return blocked;

  try {
    const existing = await prisma.serviceJob.findFirst({ where: { id: params.jobId, tenantId: params.id }, select: { id: true } });
    if (!existing) return NextResponse.json({ message: "Service job not found." }, { status: 404 });
    await prisma.serviceJob.delete({ where: { id: params.jobId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Delete service job error:", error);
    return NextResponse.json({ message: "Failed to delete service job." }, { status: 500 });
  }
}
