/** Core domain types shared across the MNI POS frontend. */

export type ThemeMode = "light" | "dark";

/** Backward-compatible module keys (seed data) + new business panel/category keys. */
export type IndustryKey =
  | "mobile"
  | "pharmacy"
  | "grocery"
  | "electronics"
  | "hardware-shop"
  | "paint-shop"
  | "cosmetics-shop";

export type BusinessCategoryKey = IndustryKey;

export type PlanKey = "starter" | "pro" | "enterprise" | "marketing-agency";

export type TenantStatus = "active" | "trial" | "deactive";
export type BusinessStatus = TenantStatus;
export type AccountType = "real" | "demo";

export type SyncState = "synced" | "syncing" | "offline";

export type RegionKey = "us-east" | "eu-central" | "ap-south";

export interface Tenant {
  id: string;
  /** Human-readable identifier, e.g. BUS-8821. */
  uid: string;
  name: string;
  /** Workspace subdomain, e.g. aura-global-network. */
  slug: string;
  industry: IndustryKey;
  plan: PlanKey;
  accountType?: AccountType;
  trialEndsAt?: string | null;
  status: TenantStatus;
  /** Admin-granted optional feature keys (see lib/features.ts). */
  features?: string[];
  /** Monthly recurring revenue in USD. */
  mrr: number;
  terminals: number;
  staff: number;
  owner: string;
  email: string;
  phone: string;
  location: string;
  createdAt: string;
  /** Display string only (demo data is intentionally deterministic). */
  lastSync: string;
  sync: SyncState;
  latencyMs: number;
  uptime: number;
  mrrDelta: number;
}

export interface TenantDraft {
  name: string;
  email: string;
  phone: string;
  location: string;
  industry: IndustryKey;
  accountType: AccountType;
  password: string;
  // legacy/edit/internal fields
  slug?: string;
  owner?: string;
  plan?: PlanKey;
  region?: RegionKey;
  seedCatalog?: boolean;
  offlineSync?: boolean;
}

export interface IndustryModule {
  key: IndustryKey;
  label: string;
  shortLabel: string;
  engine: string;
  description: string;
  bullets: string[];
  protocol: string;
  posHref: string;
  tone: "blue" | "emerald" | "amber" | "violet";
}

export interface PlanTier {
  key: PlanKey;
  name: string;
  price: number;
  cadence: string;
  blurb: string;
  outlets: string;
  terminals: string;
  features: string[];
  highlighted: boolean;
}

export type ToastTone = "success" | "info" | "warning" | "error";

export interface ToastInput {
  title: string;
  description?: string;
  tone?: ToastTone;
}

export interface ToastItem extends ToastInput {
  id: string;
  tone: ToastTone;
}

export type Business = Tenant;
export type BusinessDraft = TenantDraft;
