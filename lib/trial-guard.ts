import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const TRIAL_UPGRADE_MESSAGE = "Your 7-day free trial has ended. Upgrade to Pro to continue using this feature.";

/**
 * Returns true when a tenant's access window is expired (trial/demo ended or paid window ended).
 * Data is always preserved; this only blocks new actions.
 */
export function isTenantAccessExpired(tenant: {
  accountType?: string | null;
  status?: string | null;
  trialEndsAt?: Date | string | null;
  subscriptionPaidUntil?: Date | string | null;
}, now = new Date()): boolean {
  const status = String(tenant.status ?? "");
  if (status === "DEACTIVE") return true;

  const accountType = String(tenant.accountType ?? "");
  if (accountType === "DEMO" || status === "TRIAL") {
    if (tenant.trialEndsAt) {
      const end = new Date(tenant.trialEndsAt as any);
      if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) return true;
    }
  }

  if (tenant.subscriptionPaidUntil) {
    const end = new Date(tenant.subscriptionPaidUntil as any);
    if (!Number.isNaN(end.getTime()) && end.getTime() <= now.getTime()) return true;
  }

  return false;
}

export function upgradeRequiredResponse(message = TRIAL_UPGRADE_MESSAGE) {
  return NextResponse.json(
    { message, code: "UPGRADE_REQUIRED", upgrade: true },
    { status: 403 },
  );
}

/**
 * Enforce that a tenant can perform write/mutation actions.
 * Platform admins bypass this (they manage accounts). Returns a 403 upgrade response if blocked.
 */
export async function assertTenantWritable(
  tenantId: string,
  opts?: { adminBypass?: boolean },
): Promise<NextResponse | null> {
  if (opts?.adminBypass) return null;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, accountType: true, status: true, trialEndsAt: true, subscriptionPaidUntil: true },
  });
  if (!tenant) return NextResponse.json({ message: "Business not found." }, { status: 404 });
  if (!isTenantAccessExpired(tenant as any)) return null;

  // Best-effort auto-lock so state stays consistent (data preserved).
  await prisma.tenant.update({
    where: { id: tenantId },
    data: { status: "DEACTIVE" as any, isActive: false },
  }).catch(() => null);

  return upgradeRequiredResponse();
}
