import type { RegionKey } from "./types";

/** Tiny class-name combiner — avoids adding clsx as a dependency. */
export function cn(...inputs: Array<string | false | null | undefined>): string {
  return inputs.filter(Boolean).join(" ");
}

/** Display currency: US Dollar (international). */
export const CURRENCY = "USD";

function formatUsdBase(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safe);
}

function formatUsdCompact(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  const sign = safe < 0 ? "-" : "";
  const abs = Math.abs(safe);
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return `${sign}$${abs.toFixed(abs % 1 === 0 ? 0 : 2)}`;
}

export function formatCurrency(value: number, compact = false): string {
  return compact ? formatUsdCompact(value) : formatUsdBase(value);
}

/** Amount for POS carts and receipts (USD). */
export function formatMoney(value: number): string {
  return formatUsdBase(value);
}

/** @deprecated kept for backward compatibility; returns the same value (USD). */
export function toPKR(usdValue: number): number {
  return Math.round(usdValue);
}

export function formatNumber(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(n);
}

export function formatPercent(value: number, digits = 2): string {
  return `${value.toFixed(digits)}%`;
}

export function initials(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  return /^[+()\-\s\d]{7,20}$/.test(value.trim());
}

/** GSMA IMEI validation: exactly 15 digits and a valid Luhn checksum. */
export function isValidImei(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "");
  if (!/^\d{15}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < digits.length; i += 1) {
    let digit = Number(digits[i]);
    // Double every second digit starting from the left (check digit excluded).
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/** Pretty IMEI grouping used in receipts: 356892 11 802341 5. */
export function formatImei(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  const groups = [digits.slice(0, 6), digits.slice(6, 8), digits.slice(8, 14), digits.slice(14)];
  return groups.filter(Boolean).join(" ");
}

/** Serial / barcode heuristics for the mobile accessories terminal. */
export function isPlausibleSerial(value: string): boolean {
  const trimmed = value.trim();
  return /^[A-Z0-9][A-Z0-9-]{5,23}$/i.test(trimmed) && !/^\d{15}$/.test(trimmed);
}

export function daysUntil(isoDate: string, now = new Date()): number {
  const target = new Date(`${isoDate}T23:59:59`);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / 86_400_000);
}

export function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

/** Larger tap / focus target helper used by dense icon buttons. */
export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function isInsideLocalKeys(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    target.closest('[data-local-keys="true"]') !== null
  );
}

export const REGION_LABELS: Record<RegionKey, string> = {
  "us-east": "US-EAST-01",
  "eu-central": "EU-CENTRAL-01",
  "ap-south": "AP-SOUTH-01",
};
