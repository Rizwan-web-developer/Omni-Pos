import { prisma } from "@/lib/db";
import { FEATURE_KEYS, isFeatureKey, type FeatureKey } from "@/lib/features";

/**
 * Read the enabled feature keys for a business.
 */
export async function getTenantFeatureKeys(tenantId: string): Promise<FeatureKey[]> {
  const rows = await prisma.tenantFeature.findMany({
    where: { tenantId },
    select: { key: true },
  });
  const enabled = new Set(rows.map((row: { key: string }) => row.key));
  return FEATURE_KEYS.filter((key) => enabled.has(key));
}

/**
 * Boolean map of every optional feature for a business.
 * Used by APIs and the shop panel to decide which workflow fields/actions are available.
 */
export type TenantFlags = Record<FeatureKey, boolean>;

const EMPTY_FLAGS = FEATURE_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {} as TenantFlags);

export async function getTenantFlags(tenantId: string): Promise<TenantFlags> {
  try {
    const enabled = new Set(await getTenantFeatureKeys(tenantId));
    return FEATURE_KEYS.reduce((acc, key) => ({ ...acc, [key]: enabled.has(key) }), { ...EMPTY_FLAGS });
  } catch {
    return { ...EMPTY_FLAGS };
  }
}

/**
 * Does a business currently have a feature?
 */
export async function tenantHasFeature(tenantId: string, key: FeatureKey): Promise<boolean> {
  try {
    const row = await prisma.tenantFeature.findUnique({
      where: { tenantId_key: { tenantId, key } },
      select: { id: true },
    });
    return Boolean(row);
  } catch {
    return false;
  }
}

/**
 * Reconcile the feature access for a business.
 *
 * - Every valid key passed in is added (checkbox ON).
 * - Every existing key not passed in is removed (checkbox OFF → feature gone).
 */
export async function setTenantFeatures(tenantId: string, keys: string[]): Promise<FeatureKey[]> {
  const valid = Array.from(new Set(keys.filter(isFeatureKey)));

  const operations: any[] = [
    // Remove features that are no longer granted.
    prisma.tenantFeature.deleteMany({
      where: valid.length > 0 ? { tenantId, key: { notIn: valid } } : { tenantId },
    }),
  ];
  if (valid.length > 0) {
    // Add newly granted features (duplicates are skipped).
    operations.push(
      prisma.tenantFeature.createMany({
        data: valid.map((key) => ({ tenantId, key })),
        skipDuplicates: true,
      }),
    );
  }

  await prisma.$transaction(operations);

  return getTenantFeatureKeys(tenantId);
}
