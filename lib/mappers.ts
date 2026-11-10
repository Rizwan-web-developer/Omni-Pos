import { AccountType, BusinessStatus, IndustryType, PlanTier } from "@prisma/client";
import type { AccountType as UIAccountType, IndustryKey, PlanKey, TenantStatus } from "@/lib/types";

export function toIndustryType(key: IndustryKey | string): IndustryType {
  const map: Record<string, IndustryType> = {
    mobile: IndustryType.MOBILE_ACCESSORIES,
    pharmacy: IndustryType.PHARMACY,
    grocery: IndustryType.GROCERY,
    electronics: IndustryType.ELECTRONICS,
    "hardware-shop": IndustryType.HARDWARE_SHOP,
    "paint-shop": IndustryType.PAINT_SHOP,
    "cosmetics-shop": IndustryType.COSMETICS_SHOP,
  };
  return map[key] ?? IndustryType.ELECTRONICS;
}

export function toPlanTier(key: PlanKey | string): PlanTier {
  const map: Record<string, PlanTier> = { starter: PlanTier.STARTER, pro: PlanTier.PRO, enterprise: PlanTier.ENTERPRISE };
  return map[key] ?? PlanTier.STARTER;
}

export function toBusinessStatus(status: TenantStatus | string): BusinessStatus {
  const map: Record<string, BusinessStatus> = {
    active: BusinessStatus.ACTIVE,
    trial: BusinessStatus.TRIAL,
    deactive: BusinessStatus.DEACTIVE,
  };
  return map[status] ?? BusinessStatus.ACTIVE;
}

export function fromBusinessStatus(status: BusinessStatus | string): TenantStatus {
  const map: Record<string, TenantStatus> = {
    ACTIVE: "active",
    TRIAL: "trial",
    DEACTIVE: "deactive",
  };
  return map[status] ?? "active";
}

export function fromIndustryType(t: IndustryType | string): IndustryKey {
  const map: Record<string, IndustryKey> = {
    MOBILE_ACCESSORIES: "mobile",
    PHARMACY: "pharmacy",
    GROCERY: "grocery",
    ELECTRONICS: "electronics",
    HARDWARE_SHOP: "hardware-shop",
    PAINT_SHOP: "paint-shop",
    COSMETICS_SHOP: "cosmetics-shop",
  };
  return map[t] ?? "electronics";
}

export function fromPlanTier(t: PlanTier | string): PlanKey {
  const map: Record<string, PlanKey> = { STARTER: "starter", PRO: "pro", ENTERPRISE: "enterprise" };
  return map[t] ?? "starter";
}

export function toAccountType(v: string): AccountType {
  return String(v).toLowerCase() === "demo" ? AccountType.DEMO : AccountType.REAL;
}

export function fromAccountType(v: AccountType | string): UIAccountType {
  return String(v).toUpperCase() === "DEMO" ? "demo" : "real";
}

export function generateTempPassword(length = 12): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}
