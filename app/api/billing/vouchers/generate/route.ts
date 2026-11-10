import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth/server";
import { PACKAGE_PKR } from "@/lib/subscription";

export async function POST(req: Request) {
  const session = await requirePlatformAdmin();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body?.tenantId ?? "").trim();
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    let year = Math.floor(Number(body?.year) || currentYear);
    if (year < currentYear) year = currentYear; // no back year
    year = Math.min(2100, year);
    if (!tenantId) return NextResponse.json({ message: "tenantId is required." }, { status: 400 });

    const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!tenant) return NextResponse.json({ message: "Business not found." }, { status: 404 });

    // Never generate vouchers for months that have already passed
    const startMonth = year === currentYear ? currentMonth : 1;
    let ensured = 0;
    for (let month = startMonth; month <= 12; month++) {
      const label = `${year}-${String(month).padStart(2, "0")}`;
      await prisma.subscriptionVoucher.upsert({
        where: { tenantId_year_month: { tenantId, year, month } },
        create: { tenantId, year, month, label, amountPkr: PACKAGE_PKR, status: "UNPAID" as any },
        update: {}, // keep existing (including PAID) untouched
      });
      ensured++;
    }

    const vouchers = await prisma.subscriptionVoucher.findMany({
      where: { tenantId },
      orderBy: [{ year: "asc" }, { month: "asc" }],
    });
    const from = `${year}-${String(startMonth).padStart(2, "0")}`;
    return NextResponse.json({
      ok: true,
      year,
      from,
      ensured,
      skippedPast: year === currentYear ? currentMonth - 1 : 0,
      count: vouchers.length,
      vouchers,
      message:
        year === currentYear
          ? `Vouchers generated from ${from} onward (${ensured} month${ensured !== 1 ? "s" : ""}). Past months of ${year} are not created.`
          : `Monthly vouchers generated for ${year} (${ensured} vouchers, PKR ${PACKAGE_PKR.toLocaleString("en-PK")} each).`,
    });
  } catch (error) {
    console.error("Generate vouchers error:", error);
    return NextResponse.json({ message: "Failed to generate vouchers." }, { status: 500 });
  }
}
