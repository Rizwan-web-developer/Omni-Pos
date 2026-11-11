import type { IndustryKey } from "./types";

/**
 * Feature access catalog.
 *
 * - Core capabilities are always available to every business (POS, bulk stock, invoices…).
 * - Optional features are granted per business by the platform admin from the Access page.
 *   Turning a checkbox ON creates the feature for that business. Turning it OFF removes it.
 * - Bulk-quantity stock is intentionally always on for every industry.
 */

export type FeatureKey =
  | "SERIAL_IMEI"
  | "WARRANTY"
  | "BATCH_EXPIRY"
  | "PRESCRIPTION"
  | "PAINT_SHADE"
  | "INSTALLMENTS"
  | "SERVICE_JOBS"
  | "BARCODE_FAST"
  | "MULTI_UNIT"
  | "SUPPLIER_LEDGER"
  | "OFFLINE_SYNC"
  | "ADVANCED_ANALYTICS"
  | "MULTI_USER"
  | "DISCOUNTS";

export type FeatureGroup = "Inventory & Stock" | "Selling & Billing" | "Operations" | "Growth & Control";

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  short: string;
  description: string;
  group: FeatureGroup;
  /** Industries where this feature is usually needed (used for recommendations/badges). */
  recommendedFor: IndustryKey[];
}

export const FEATURES: FeatureDef[] = [
  {
    key: "SERIAL_IMEI",
    label: "IMEI / Serial tracking",
    short: "IMEI/Serial",
    description:
      "High-value products are tracked per unit: add Serial/IMEI numbers, select or scan the exact unit at checkout, and keep a sold/unsold ledger.",
    group: "Inventory & Stock",
    recommendedFor: ["mobile", "electronics"],
  },
  {
    key: "WARRANTY",
    label: "Warranty tracking",
    short: "Warranty",
    description: "Store warranty days against serialized units and print warranty details on the customer receipt.",
    group: "Inventory & Stock",
    recommendedFor: ["mobile", "electronics"],
  },
  {
    key: "BATCH_EXPIRY",
    label: "Batch & expiry",
    short: "Batch/Expiry",
    description: "Track batch numbers and expiry dates with near-expiry alerts — essential for medicines and cosmetics.",
    group: "Inventory & Stock",
    recommendedFor: ["pharmacy", "cosmetics-shop"],
  },
  {
    key: "PRESCRIPTION",
    label: "Prescription sales",
    short: "Prescription",
    description: "Mark prescription-only products and record doctor/customer details during medical store billing.",
    group: "Selling & Billing",
    recommendedFor: ["pharmacy"],
  },
  {
    key: "PAINT_SHADE",
    label: "Paint shade & formula",
    short: "Shades",
    description: "Keep shade codes, base type, pack sizes and mixing formulas for every paint product.",
    group: "Inventory & Stock",
    recommendedFor: ["paint-shop"],
  },
  {
    key: "INSTALLMENTS",
    label: "Installment sales",
    short: "Installments",
    description: "Sell high-value items on installments with down payment and simple repayment tracking.",
    group: "Selling & Billing",
    recommendedFor: ["electronics", "mobile"],
  },
  {
    key: "SERVICE_JOBS",
    label: "Repair & service jobs",
    short: "Service jobs",
    description: "Create job cards for repairs, track device status and notify the customer when the job is ready.",
    group: "Operations",
    recommendedFor: ["mobile", "electronics"],
  },
  {
    key: "BARCODE_FAST",
    label: "Fast barcode billing",
    short: "Barcode",
    description: "Scanner-first billing flow for shops that sell many small items across a busy counter.",
    group: "Selling & Billing",
    recommendedFor: ["pharmacy", "cosmetics-shop", "hardware-shop"],
  },
  {
    key: "MULTI_UNIT",
    label: "Units & measurements",
    short: "Multi-unit",
    description: "Sell by piece, kilogram, litre, foot or bundle with unit conversion for hardware/paint counters.",
    group: "Inventory & Stock",
    recommendedFor: ["hardware-shop", "paint-shop"],
  },
  {
    key: "SUPPLIER_LEDGER",
    label: "Supplier & credit ledger",
    short: "Suppliers",
    description: "Record purchases from suppliers and keep a running payable/credit balance.",
    group: "Operations",
    recommendedFor: ["pharmacy", "hardware-shop", "paint-shop", "electronics", "mobile", "cosmetics-shop"],
  },
  {
    key: "OFFLINE_SYNC",
    label: "Offline sync",
    short: "Offline",
    description: "Keep selling when the internet drops; sales sync automatically when the connection returns.",
    group: "Operations",
    recommendedFor: ["pharmacy", "mobile", "electronics", "hardware-shop", "paint-shop", "cosmetics-shop"],
  },
  {
    key: "ADVANCED_ANALYTICS",
    label: "Advanced analytics",
    short: "Analytics",
    description: "Profit, top brands, best sellers and sales trends on the shop overview.",
    group: "Growth & Control",
    recommendedFor: ["pharmacy", "mobile", "electronics", "hardware-shop", "paint-shop", "cosmetics-shop"],
  },
  {
    key: "MULTI_USER",
    label: "Staff accounts & roles",
    short: "Staff",
    description: "Add manager/cashier accounts with restricted access for your team.",
    group: "Growth & Control",
    recommendedFor: ["pharmacy", "mobile", "electronics", "hardware-shop", "paint-shop", "cosmetics-shop"],
  },
  {
    key: "DISCOUNTS",
    label: "Discounts & promotions",
    short: "Discounts",
    description: "Give line-level discounts and run simple promotions at the counter.",
    group: "Selling & Billing",
    recommendedFor: ["pharmacy", "mobile", "electronics", "hardware-shop", "paint-shop", "cosmetics-shop"],
  },
];

export const FEATURE_BY_KEY: Record<FeatureKey, FeatureDef> = FEATURES.reduce(
  (acc, feature) => ({ ...acc, [feature.key]: feature }),
  {} as Record<FeatureKey, FeatureDef>,
);

export const FEATURE_KEYS: FeatureKey[] = FEATURES.map((f) => f.key);

export const FEATURE_GROUPS: FeatureGroup[] = [
  "Inventory & Stock",
  "Selling & Billing",
  "Operations",
  "Growth & Control",
];

export function isFeatureKey(value: unknown): value is FeatureKey {
  return typeof value === "string" && (FEATURE_KEYS as string[]).includes(value);
}

/** Features every business gets regardless of package (bulk stock is always on). */
export const CORE_FEATURES = [
  { label: "POS / Sell", description: "Counter billing, cash/card and printable receipt." },
  { label: "Bulk quantity stock", description: "Always included — add stock in bulk for every product." },
  { label: "Invoices & sales history", description: "Printable invoices and searchable sales records." },
  { label: "Brands & categories", description: "Catalogue organisation with brand photos." },
  { label: "Shop profile & support", description: "Logo, profile, password and support tickets." },
] as const;

/** Recommended feature set per industry (pre-checked when the admin creates the business). */
export const INDUSTRY_FEATURES: Record<IndustryKey, FeatureKey[]> = {
  mobile: ["SERIAL_IMEI", "WARRANTY", "INSTALLMENTS", "SERVICE_JOBS", "DISCOUNTS", "ADVANCED_ANALYTICS"],
  electronics: ["SERIAL_IMEI", "WARRANTY", "INSTALLMENTS", "SERVICE_JOBS", "DISCOUNTS", "ADVANCED_ANALYTICS"],
  pharmacy: ["BATCH_EXPIRY", "PRESCRIPTION", "BARCODE_FAST", "SUPPLIER_LEDGER", "OFFLINE_SYNC", "ADVANCED_ANALYTICS"],
  "cosmetics-shop": ["BATCH_EXPIRY", "BARCODE_FAST", "DISCOUNTS", "ADVANCED_ANALYTICS", "MULTI_USER"],
  "paint-shop": ["PAINT_SHADE", "MULTI_UNIT", "SUPPLIER_LEDGER", "DISCOUNTS", "ADVANCED_ANALYTICS"],
  "hardware-shop": ["MULTI_UNIT", "BARCODE_FAST", "SUPPLIER_LEDGER", "DISCOUNTS", "OFFLINE_SYNC"],
  grocery: ["BARCODE_FAST", "DISCOUNTS", "OFFLINE_SYNC", "ADVANCED_ANALYTICS"],
};

export function recommendedFeatures(industry: string): FeatureKey[] {
  return INDUSTRY_FEATURES[industry as IndustryKey] ?? ["DISCOUNTS", "ADVANCED_ANALYTICS"];
}

/** Features that require the SERIAL_IMEI engine (warranty is stored on serial units). */
export function requiresSerialEngine(key: FeatureKey): boolean {
  return key === "SERIAL_IMEI" || key === "WARRANTY";
}
