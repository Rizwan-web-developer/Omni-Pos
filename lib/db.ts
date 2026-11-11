import { PrismaClient } from "@prisma/client";

/**
 * Normalize a connection string coming from env vars. Dashboards/CLI uploads
 * sometimes keep surrounding quotes or whitespace, which breaks Prisma URLs.
 */
export function normalizeDatabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  let value = raw.trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1).trim();
  }
  return value || undefined;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    ...(normalizeDatabaseUrl(process.env.DATABASE_URL)
      ? { datasourceUrl: normalizeDatabaseUrl(process.env.DATABASE_URL) }
      : {}),
  });

// Cache globally in all environments (important for serverless/Vercel to reuse connections across warm invocations).
globalForPrisma.prisma = prisma;
