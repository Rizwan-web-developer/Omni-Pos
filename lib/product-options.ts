import type { TenantFlags } from "@/lib/tenant-features";

/**
 * Optional product workflow fields, each gated by an Access feature.
 *
 * - BATCH_EXPIRY  -> batchNumber, expiryDate
 * - PRESCRIPTION  -> prescriptionRequired
 * - PAINT_SHADE   -> shadeCode, paintBase, packSize
 * - MULTI_UNIT    -> unitLabel
 * - INSTALLMENTS  -> installmentAvailable
 * - SERVICE_JOBS  -> serviceItem
 *
 * When a feature is NOT granted the field is ignored (never stored), which is the
 * same add/remove behaviour used everywhere else in the access-control system.
 */

export const UNIT_LABELS = [
  "piece",
  "pack",
  "box",
  "dozen",
  "kg",
  "gram",
  "litre",
  "ml",
  "foot",
  "meter",
  "bundle",
] as const;

const UNIT_SET = new Set<string>(UNIT_LABELS);

export function normalizeUnitLabel(input: unknown): string | null {
  const value = String(input ?? "").trim().toLowerCase();
  if (!value) return null;
  return UNIT_SET.has(value) ? value : null;
}

export function parseOptionalDate(input: unknown): Date | null {
  if (input === null || input === undefined) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function cleanText(input: unknown, max = 60): string | null {
  const value = String(input ?? "").trim();
  return value ? value.slice(0, max) : null;
}

/**
 * Build the Prisma data patch for optional product fields.
 * `strict` (POST/create) rejects obviously invalid values; PATCH is lenient.
 */
export function buildFeatureProductFields(
  body: Record<string, any>,
  flags: TenantFlags,
): { data: Record<string, unknown>; error?: string } {
  const data: Record<string, unknown> = {};

  if (flags.BATCH_EXPIRY) {
    if (body.batchNumber !== undefined) data.batchNumber = cleanText(body.batchNumber, 40);
    if (body.expiryDate !== undefined) {
      if (body.expiryDate === null || String(body.expiryDate).trim() === "") {
        data.expiryDate = null;
      } else {
        const d = parseOptionalDate(body.expiryDate);
        if (!d) {
          // Keep the existing value when a malformed date is supplied during PATCH.
          if (body.expiryDate !== null) return { data, error: "Invalid expiry date." };
        } else {
          data.expiryDate = d;
        }
      }
    }
  }

  if (flags.PRESCRIPTION && body.prescriptionRequired !== undefined) {
    data.prescriptionRequired = Boolean(body.prescriptionRequired);
  }

  if (flags.PAINT_SHADE) {
    if (body.shadeCode !== undefined) data.shadeCode = cleanText(body.shadeCode, 40);
    if (body.paintBase !== undefined) data.paintBase = cleanText(body.paintBase, 40);
    if (body.packSize !== undefined) data.packSize = cleanText(body.packSize, 40);
  }

  if (flags.MULTI_UNIT && body.unitLabel !== undefined) {
    data.unitLabel = normalizeUnitLabel(body.unitLabel);
  }

  if (flags.INSTALLMENTS && body.installmentAvailable !== undefined) {
    data.installmentAvailable = Boolean(body.installmentAvailable);
  }

  if (flags.SERVICE_JOBS && body.serviceItem !== undefined) {
    data.serviceItem = Boolean(body.serviceItem);
  }

  return { data };
}

/** Serialize optional product workflow fields for the shop UI. */
export function serializeFeatureProductFields(p: any) {
  return {
    batchNumber: p?.batchNumber ?? null,
    expiryDate: p?.expiryDate ?? null,
    prescriptionRequired: Boolean(p?.prescriptionRequired),
    shadeCode: p?.shadeCode ?? null,
    paintBase: p?.paintBase ?? null,
    packSize: p?.packSize ?? null,
    unitLabel: p?.unitLabel ?? null,
    installmentAvailable: Boolean(p?.installmentAvailable),
    serviceItem: Boolean(p?.serviceItem),
  };
}
