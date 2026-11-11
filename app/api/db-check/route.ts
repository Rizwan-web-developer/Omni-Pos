import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

function sanitize(message: string): string {
  // Never leak credentials or full connection strings.
  return message
    .replace(/postgres(ql)?:\/\/[^@\s]+@/gi, "postgresql://***@")
    .replace(/password=[^&\s]+/gi, "password=***");
}

/**
 * Public, read-only DB diagnostics endpoint used to verify the deployed
 * environment can reach the database. Returns no business data, only
 * connection status and a sanitized error message.
 */
export async function GET() {
  const hasUrl = Boolean(process.env.DATABASE_URL);
  const driver = (() => {
    const raw = process.env.DATABASE_URL ?? "";
    try {
      const parsed = new URL(raw);
      return {
        protocol: parsed.protocol.replace(":", ""),
        host: parsed.hostname,
        port: parsed.port || "default",
        database: parsed.pathname.replace(/^\//, "") || "(none)",
        sslmode: parsed.searchParams.get("sslmode"),
        pgbouncer: parsed.searchParams.get("pgbouncer"),
      };
    } catch {
      return { parseError: true };
    }
  })();

  if (!hasUrl) {
    return NextResponse.json(
      { ok: false, hasUrl: false, message: "DATABASE_URL is not set in this environment." },
      { status: 500 },
    );
  }

  try {
    const [{ result }] = await prisma.$queryRaw<{ result: number }[]>`SELECT 1 as result`;
    return NextResponse.json({ ok: true, hasUrl, driver, query: result === 1 ? "SELECT 1 OK" : "unexpected" });
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const code = (error as { code?: string })?.code;
    return NextResponse.json(
      {
        ok: false,
        hasUrl,
        driver,
        code: code ?? null,
        error: sanitize(raw),
      },
      { status: 500 },
    );
  }
}
