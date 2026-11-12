import nodemailer from "nodemailer";
import { BRAND_NAME, CONTACT_EMAIL } from "@/lib/brand";

const SMTP_USER = process.env.SMTP_USER || "rk3113798@gmail.com";
const SMTP_PASS = (process.env.SMTP_APP_PASSWORD || "xztf kozt qacm gqrw").replace(/\s+/g, "");
const FROM_EMAIL = process.env.SMTP_FROM || SMTP_USER;

let cached: any = null;

function transporter(): any {
  if (!cached) {
    cached = nodemailer.createTransport({
      service: "gmail",
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return cached;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function otpEmailHtml(code: string, purpose: "login" | "signup"): string {
  const title = purpose === "signup" ? "Verify your email" : "Your login code";
  const intro =
    purpose === "signup"
      ? `Welcome to ${BRAND_NAME}. Use the code below to verify your email and activate your 7-day free trial.`
      : `Use the code below to securely sign in to ${BRAND_NAME}.`;
  const safeCode = escapeHtml(code);
  const logoUrl = `${process.env.NEXTAUTH_URL || "http://localhost:3000"}/logo.png`;
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:20px 24px;background:linear-gradient(135deg,#fff7ed,#ffffff);border-bottom:1px solid #fed7aa;">
              <div style="display:flex;align-items:center;gap:10px;">
                <img src="${logoUrl}" alt="${escapeHtml(BRAND_NAME)}" style="width:36px;height:36px;object-fit:contain;border-radius:8px;" />
                <div style="font-size:20px;font-weight:700;color:#ea580c;letter-spacing:0.2px;">${escapeHtml(BRAND_NAME)}</div>
              </div>
              <div style="margin-top:4px;font-size:13px;color:#475569;">POS &amp; stock management for every business</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px;">
              <h1 style="margin:0 0 10px;font-size:22px;line-height:1.3;color:#0f172a;">${title}</h1>
              <p style="margin:0 0 18px;font-size:14px;line-height:1.7;color:#334155;">${intro}</p>
              <div style="margin:0 0 18px;padding:16px 18px;border:1px dashed #fdba74;border-radius:12px;background:#fff7ed;text-align:center;">
                <div style="font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#9a3412;margin-bottom:6px;">One-time code</div>
                <div style="font-size:34px;font-weight:700;letter-spacing:8px;color:#c2410c;">${safeCode}</div>
              </div>
              <p style="margin:0 0 6px;font-size:13px;color:#475569;">This code expires in <strong>10 minutes</strong>.</p>
              <p style="margin:0;font-size:13px;color:#64748b;">If you didn't request this, you can safely ignore this email.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
              ${escapeHtml(BRAND_NAME)} &middot; Support: <a href="mailto:${escapeHtml(CONTACT_EMAIL)}" style="color:#ea580c;text-decoration:none;">${escapeHtml(CONTACT_EMAIL)}</a>
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

export async function sendOtpEmail(to: string, code: string, purpose: "login" | "signup"): Promise<void> {
  const subject =
    purpose === "signup"
      ? `${BRAND_NAME} — Verify your email`
      : `${BRAND_NAME} — Your login code`;
  await transporter().sendMail({
    from: `${BRAND_NAME} <${FROM_EMAIL}>`,
    to,
    subject,
    text: `${BRAND_NAME}\n\nYour ${purpose === "signup" ? "verification" : "login"} code is: ${code}\nThis code expires in 10 minutes.\n\nIf you didn't request this, you can ignore this email.\nSupport: ${CONTACT_EMAIL}`,
    html: otpEmailHtml(code, purpose),
  });
}
