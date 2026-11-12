import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { sendOtpEmail } from "@/lib/mailer";

export type OtpPurpose = "LOGIN" | "SIGNUP";

const OTP_TTL_MS = 10 * 60 * 1000;

function hashCode(email: string, purpose: OtpPurpose, code: string): string {
  return createHash("sha256").update(`${purpose}:${email.toLowerCase()}:${code}`).digest("hex");
}

export async function issueOtp(email: string, purpose: OtpPurpose, payload?: Record<string, unknown>): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = hashCode(normalized, purpose, code);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await (prisma as any).emailOtp.deleteMany({ where: { email: normalized, purpose } });
  await (prisma as any).emailOtp.create({
    data: { email: normalized, purpose, codeHash, expiresAt, payload: payload ?? null },
  });
  await sendOtpEmail(normalized, code, purpose === "SIGNUP" ? "signup" : "login");
}

export async function consumeOtp(
  email: string,
  purpose: OtpPurpose,
  code: string,
): Promise<{ ok: true; payload: any } | { ok: false; message: string }> {
  const normalized = email.trim().toLowerCase();
  const expected = hashCode(normalized, purpose, String(code || "").trim());
  const record = await (prisma as any).emailOtp.findFirst({
    where: { email: normalized, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return { ok: false, message: "Invalid or expired verification code." };
  if (record.expiresAt.getTime() < Date.now()) {
    await (prisma as any).emailOtp.delete({ where: { id: record.id } }).catch(() => null);
    return { ok: false, message: "Verification code expired. Please request a new one." };
  }
  if ((record.attempts ?? 0) >= 8) {
    await (prisma as any).emailOtp.delete({ where: { id: record.id } }).catch(() => null);
    return { ok: false, message: "Too many invalid attempts. Please request a new code." };
  }
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(String(record.codeHash), "hex");
  const match = a.length === b.length && timingSafeEqual(a, b);
  if (!match) {
    await (prisma as any).emailOtp.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } }).catch(() => null);
    return { ok: false, message: "Invalid verification code." };
  }
  await (prisma as any).emailOtp.update({ where: { id: record.id }, data: { consumedAt: new Date() } }).catch(() => null);
  return { ok: true, payload: record.payload ?? null };
}
