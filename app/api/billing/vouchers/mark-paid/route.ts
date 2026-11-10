import { NextResponse } from "next/server";
import { BusinessStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/server";
import { computeValidUntil, paymentWindowDays } from "@/lib/subscription";

export async function POST(req: Request) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body?.tenantId ?? "").trim();
    const voucherIds = Array.isArray(body?.voucherIds) ? body.voucherIds.map((v: unknown) => String(v)).filter(Boolean) : [];
    if (!tenantId) return NextResponse.json({ message: "tenantId is required." }, { status: 400 });
    if (voucherIds.length === 0) return NextResponse.json({ message: "Select at least one voucher to mark paid." }, { status: 400 });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, accountType: true } });
    if (!tenant) return NextResponse.json({ message: "Business not found." }, { status: 404 });

    // Only mark UNPAID vouchers belonging to this tenant
    const targets = await prisma.subscriptionVoucher.findMany({
      where: { id: { in: voucherIds }, tenantId, status: "UNPAID" as any },
      select: { id: true },
    });
    if (targets.length === 0) return NextResponse.json({ message: "No unpaid vouchers selected (they may already be paid)." }, { status: 400 });

    const paidAt = new Date(); // exact day & time admin marked Paid
    const n = targets.length;
    const validUntil = computeValidUntil(paidAt, n);
    const ids = targets.map((t: { id: string }) => t.id);

    await prisma.$transaction([
      prisma.subscriptionVoucher.updateMany({
        where: { id: { in: ids } },
        data: { status: "PAID" as any, paidAt, validUntil, notes: `Marked paid (${n} voucher${n > 1 ? "s" : ""}) = ${paymentWindowDays(n)} days` },
      }),
      prisma.tenant.update({
        where: { id: tenantId },
        data: {
          lastPaidAt: paidAt,
          subscriptionPaidUntil: validUntil,
          status: BusinessStatus.ACTIVE,
          isActive: true,
        },
      }),
    ]);

    const vouchers = await prisma.subscriptionVoucher.findMany({ where: { tenantId }, orderBy: [{ year: "desc" }, { month: "asc" }] });
    return NextResponse.json({
      ok: true,
      paidAt,
      validUntil,
      days: paymentWindowDays(n),
      count: n,
      vouchers,
      message: `Marked ${n} voucher${n > 1 ? "s" : ""} paid. Panel open for ${paymentWindowDays(n)} days (until ${validUntil.toLocaleString("en-PK")}). Auto-locks after that (data preserved).`,
    });
  } catch (error) {
    console.error("Mark paid error:", error);
    return NextResponse.json({ message: "Failed to mark vouchers paid." }, { status: 500 });
  }
}
