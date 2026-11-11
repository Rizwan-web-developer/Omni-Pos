import {
  Paintbrush,
  Pill,
  ShoppingCart,
  Smartphone,
  Sparkles,
  Tv,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import type { IndustryKey, IndustryModule, PlanKey, PlanTier, Tenant, TenantStatus } from "./types";

/* -------------------------------------------------------------------------- */
/*  BUSINESS CATEGORIES / PANELS                                              */
/*  Each category maps to its own customized panel/workflow.                  */
/* -------------------------------------------------------------------------- */

export const INDUSTRIES: IndustryModule[] = [
  {
    key: "electronics",
    label: "Electronics Shop",
    shortLabel: "Electronics",
    engine: "Electronics Panel",
    description:
      "Customized for electronics shops: serials, warranties, installments, accessories and service workflows.",
    bullets: ["Product serial/warranty tracking", "Installments & service tickets", "Accessories and bundles"],
    protocol: "Electronics workflow",
    posHref: "/panel/electronics",
    tone: "violet",
  },
  {
    key: "hardware-shop",
    label: "Hardware Shop",
    shortLabel: "Hardware",
    engine: "Hardware Panel",
    description:
      "Customized for hardware stores: units, measurements, bulk items, fast billing and stock control.",
    bullets: ["Bulk/measurement-based items", "Fast counter billing", "Supplier & stock tracking"],
    protocol: "Hardware workflow",
    posHref: "/panel/hardware-shop",
    tone: "amber",
  },
  {
    key: "mobile",
    label: "Mobile Accessories & Gadgets",
    shortLabel: "Mobile & Gadgets",
    engine: "IMEI / Serial Panel",
    description:
      "Customized for mobile accessories and gadgets: IMEI/serial validation, warranty and device-level sales.",
    bullets: ["IMEI/serial validation", "Device & accessory checkout", "Warranty/trade-in ledger"],
    protocol: "GSMA/Serial workflow",
    posHref: "/pos/mobile-accessories",
    tone: "blue",
  },
  {
    key: "paint-shop",
    label: "Paint Shop",
    shortLabel: "Paint",
    engine: "Paint Panel",
    description:
      "Customized for paint businesses: shades, mixing formulas, container sizes, and paint-specific inventory.",
    bullets: ["Shade & formula catalog", "Container/quantity variants", "Paint-specific billing"],
    protocol: "Paint workflow",
    posHref: "/panel/paint-shop",
    tone: "emerald",
  },
  {
    key: "cosmetics-shop",
    label: "Cosmetics Shop",
    shortLabel: "Cosmetics",
    engine: "Cosmetics Panel",
    description:
      "Customized for cosmetics: product variants, shades, batches/expiry where needed, and beauty retail flows.",
    bullets: ["Variant/shade product lists", "Beauty retail checkout", "Batch/expiry when applicable"],
    protocol: "Cosmetics workflow",
    posHref: "/panel/cosmetics-shop",
    tone: "violet",
  },
  {
    key: "pharmacy",
    label: "Medical Store",
    shortLabel: "Medical",
    engine: "Pharmacy Panel",
    description:
      "Customized for pharmacies: batches, expiry, FEFO dispensing and regulated medicine workflows.",
    bullets: ["Batch + expiry enforcement", "FEFO allocation", "Dispense verification"],
    protocol: "Pharmacy workflow",
    posHref: "/pos/pharmacy",
    tone: "emerald",
  },
  {
    key: "grocery",
    label: "Grocery & Supermart",
    shortLabel: "Grocery",
    engine: "Grocery Panel",
    description:
      "Customized for grocery/supermarts: fast barcode billing, categories, stock and multi-lane operations.",
    bullets: ["Fast barcode checkout", "Category & stock control", "Promotions/bundles"],
    protocol: "Grocery workflow",
    posHref: "/panel/grocery",
    tone: "amber",
  },
];

export const INDUSTRY_BY_KEY: Record<IndustryKey, IndustryModule> = INDUSTRIES.reduce(
  (acc, industry) => ({ ...acc, [industry.key]: industry }),
  {} as Record<IndustryKey, IndustryModule>,
);

export const INDUSTRY_ICONS: Record<IndustryKey, LucideIcon> = {
  mobile: Smartphone,
  pharmacy: Pill,
  grocery: ShoppingCart,
  electronics: Tv,
  "hardware-shop": Wrench,
  "paint-shop": Paintbrush,
  "cosmetics-shop": Sparkles,
};

/** Static class strings keep Tailwind's JIT happy (no dynamic class names). */
export const INDUSTRY_TONES: Record<
  IndustryModule["tone"],
  { icon: string; chip: string; dot: string; bar: string }
> = {
  blue: {
    icon: "bg-accent-soft text-accent",
    chip: "border-accent-line bg-accent-soft text-accent",
    dot: "bg-brand",
    bar: "bg-brand",
  },
  emerald: {
    icon: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    chip: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    bar: "bg-emerald-500",
  },
  amber: {
    icon: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    chip: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    bar: "bg-amber-500",
  },
  violet: {
    icon: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    chip: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    dot: "bg-violet-500",
    bar: "bg-violet-500",
  },
};

/* -------------------------------------------------------------------------- */
/*  PLANS                                                                     */
/* -------------------------------------------------------------------------- */

/** Plan pricing in PKR (local market). */
export const PLANS: PlanTier[] = [
  {
    key: "starter",
    name: "Starter",
    price: 15000,
    cadence: "/mo",
    blurb: "One storefront finding its rhythm.",
    outlets: "1 outlet",
    terminals: "2 terminals",
    features: ["Core panel access", "Local support", "Email support"],
    highlighted: false,
  },
  {
    key: "pro",
    name: "Pro",
    price: 45000,
    cadence: "/mo",
    blurb: "Multi-branch operators that need room.",
    outlets: "5 outlets",
    terminals: "15 terminals",
    features: ["Business category panels", "Offline sync + audit log", "Priority support"],
    highlighted: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    price: 120000,
    cadence: "/mo",
    blurb: "Regulated, high-volume chains.",
    outlets: "Unlimited outlets",
    terminals: "Unlimited terminals",
    features: ["Dedicated support", "Custom setup", "Priority incident handling"],
    highlighted: false,
  },
];

export const PLAN_BY_KEY: Record<PlanKey, PlanTier> = PLANS.reduce(
  (acc, plan) => ({ ...acc, [plan.key]: plan }),
  {} as Record<PlanKey, PlanTier>,
);

export const PLAN_BADGE: Record<PlanKey, string> = {
  starter: "border-slate-400/25 bg-slate-500/10 text-slate-600 dark:text-slate-300",
  pro: "border-accent-line bg-accent-soft text-accent",
  enterprise: "border-violet-500/25 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

/* -------------------------------------------------------------------------- */
/*  STATUS                                                                    */
/* -------------------------------------------------------------------------- */

export const STATUS_ORDER: TenantStatus[] = ["active", "trial", "deactive"];

export const STATUS_META: Record<
  TenantStatus,
  { label: string; className: string; dot: string; description: string }
> = {
  active: {
    label: "Active",
    className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    dot: "bg-emerald-500",
    description: "Business is active and can use its panel.",
  },
  trial: {
    label: "Trial",
    className: "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    dot: "bg-sky-500",
    description: "Evaluation workspace, billing not started.",
  },
  deactive: {
    label: "Deactive (Locked)",
    className: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    dot: "bg-amber-500",
    description: "Access locked until reactivated by admin.",
  },
};

/* -------------------------------------------------------------------------- */
/*  SEED BUSINESSES (demo) — Pakistan/local market                            */
/* -------------------------------------------------------------------------- */

export const SEED_TENANTS: Tenant[] = [
  {
    id: "t-business-1",
    uid: "BUS-1001",
    name: "Al Madina Mobile & Electronics",
    slug: "almadina-mobile",
    industry: "mobile",
    plan: "pro",
    status: "active",
    mrr: 0,
    terminals: 2,
    staff: 4,
    owner: "Rizwan K.",
    email: "rizwan@almadina.pk",
    phone: "+92 300 1234567",
    location: "Karachi, Pakistan",
    createdAt: "Jan 15, 2025",
    lastSync: "just now",
    sync: "synced",
    latencyMs: 0,
    uptime: 0,
    mrrDelta: 0,
  },
];

/* -------------------------------------------------------------------------- */
/*  METRICS / ANALYTICS (PKR, local)                                          */
/* -------------------------------------------------------------------------- */

export const GLOBAL_METRICS = {
  mrr: 0,
  mrrDelta: 0,
  activeTenants: SEED_TENANTS.filter((tenant) => tenant.status === "active").length,
  totalTenants: SEED_TENANTS.length,
  outlets: 1,
  outletsDelta: 0,
  syncRate: 0,
  churn: 0,
  retention: 0,
  avgLatency: 0,
  offlineQueues: 0,
};

/** Generates analytics points for a date range (all values set to 0). */
export function getRevenueSeries(startIso: string, endIso: string): Array<{ date: string; label: string; revenue: number }> {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const days = Math.min(366, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  const points: Array<{ date: string; label: string; revenue: number }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-PK", { day: "2-digit", month: "short" });
    points.push({ date: iso, label, revenue: 0 });
  }
  if (points.length <= 40) return points;
  const step = Math.ceil(points.length / 36);
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}

export const SHARD_HEALTH = [
  { id: "us-east-01", label: "US-EAST-01", region: "N. Virginia", latency: 12, nodes: 412, status: "operational" as const, load: 71 },
  { id: "eu-central-01", label: "EU-CENTRAL-01", region: "Frankfurt", latency: 18, nodes: 288, status: "operational" as const, load: 64 },
  { id: "ap-south-01", label: "AP-SOUTH-01", region: "Mumbai", latency: 34, nodes: 196, status: "degraded" as const, load: 83 },
];

export const DEMO_TENANT_ID = "t-aura";
