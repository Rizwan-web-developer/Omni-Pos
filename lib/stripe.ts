import Stripe from "stripe";

import { PACKAGE_PRICES_USD } from "@/lib/subscription";
import { currencyForCountry } from "@/lib/utils";

export const STRIPE_PACKAGES = [
  { key: "starter", tier: "STARTER", label: "Starter", priceUsd: PACKAGE_PRICES_USD.STARTER },
  { key: "pro", tier: "PRO", label: "Growth", priceUsd: PACKAGE_PRICES_USD.PRO },
  { key: "marketing-agency", tier: "MARKETING_AGENCY", label: "Marketing Agency", priceUsd: PACKAGE_PRICES_USD.MARKETING_AGENCY },
] as const;

export type StripePackageKey = (typeof STRIPE_PACKAGES)[number]["key"];

export function isPakistanCountry(country?: string | null): boolean {
  const c = (country || "").trim().toLowerCase();
  return c === "pakistan" || c === "pk" || c === "islamic republic of pakistan";
}

export function isInternationalBillingCountry(country?: string | null): boolean {
  // Pakistan/local clients use manual billing in admin dashboard.
  // All other regions/countries use automatic Stripe subscription billing.
  return !isPakistanCountry(country);
}

export function billingModeForCountry(country?: string | null): "LOCAL_MANUAL" | "INTERNATIONAL_AUTO" {
  return isPakistanCountry(country) ? "LOCAL_MANUAL" : "INTERNATIONAL_AUTO";
}

export function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key);
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function priceIdForPackage(packageKey: string): string | null {
  const key = packageKey.toLowerCase();
  const map: Record<string, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    "marketing-agency": process.env.STRIPE_PRICE_MARKETING_AGENCY,
    marketing_agency: process.env.STRIPE_PRICE_MARKETING_AGENCY,
  };
  const value = map[key];
  return value && value.trim() ? value.trim() : null;
}

export function packageByKey(packageKey: string) {
  return STRIPE_PACKAGES.find((p) => p.key === packageKey || p.tier === packageKey.toUpperCase()) ?? null;
}
