import { AccountType, BusinessStatus } from "@prisma/client";

export const PACKAGE_PKR = 15000;
export const DAYS_PER_VOUCHER = 30;
export const GRACE_DAYS = 5; // 1 voucher = 35 days; N vouchers = N*30 + 5 days

export function paymentWindowDays(voucherCount: number): number {
  const n = Math.max(1, Math.floor(voucherCount));
  return n * DAYS_PER_VOUCHER + GRACE_DAYS;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Compute valid-until for marking `n` vouchers paid at `paidAt`. */
export function computeValidUntil(paidAt: Date, voucherCount: number): Date {
  return addDays(paidAt, paymentWindowDays(voucherCount));
}

export function formatPkr(amount: number): string {
  return `PKR ${Math.round(amount).toLocaleString("en-PK")}`;
}

type TenantExpiryFields = {
  id: string;
  accountType: AccountType | string;
  status: BusinessStatus | string;
  trialEndsAt?: Date | null;
  subscriptionPaidUntil?: Date | null;
};

export function isDemoExpired(t: TenantExpiryFields, now = new Date()): boolean {
  if (String(t.accountType) !== "DEMO") return false;
  if (!t.trialEndsAt) return false;
  return t.trialEndsAt.getTime() <= now.getTime() && String(t.status) !== "DEACTIVE";
}

export function isSubscriptionExpired(t: TenantExpiryFields, now = new Date()): boolean {
  // Subscription paid-until governs paid/real access windows (auto-lock, data preserved)
  if (!t.subscriptionPaidUntil) return false;
  return t.subscriptionPaidUntil.getTime() <= now.getTime() && String(t.status) !== "DEACTIVE";
}

export function shouldLockTenant(t: TenantExpiryFields, now = new Date()): boolean {
  return isDemoExpired(t, now) || isSubscriptionExpired(t, now);
}

/** Lazy enforcement: lock if demo/subscription expired. Returns true if it locked. */
export async function enforceTenantExpiry(
  prisma: { tenant: { update: (args: any) => Promise<any> } },
  t: TenantExpiryFields | null | undefined,
  now = new Date(),
): Promise<boolean> {
  if (!t || !shouldLockTenant(t, now)) return false;
  await prisma.tenant.update({ where: { id: t.id }, data: { status: BusinessStatus.DEACTIVE, isActive: false } }).catch(() => {});
  return true;
}
