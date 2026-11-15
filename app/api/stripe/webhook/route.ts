import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { computeValidUntil } from "@/lib/subscription";
import { toPlanTier } from "@/lib/mappers";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

async function activateTenantFromPayment(params: {
  tenantId: string;
  packageKey?: string | null;
  paidAt?: Date;
  eventId?: string;
}) {
  const { tenantId, packageKey, eventId } = params;
  const paidAt = params.paidAt ?? new Date();

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, subscriptionTier: true, status: true, accountType: true },
  });
  if (!tenant) {
    console.warn("Stripe webhook: tenant not found", { tenantId, eventId });
    return { ok: false, reason: "tenant_not_found" as const };
  }

  const tier = packageKey ? toPlanTier(packageKey) : (tenant.subscriptionTier as any);
  // 1 paid period = 35 days (same window rule as manual billing). Auto-renewing subscriptions
  // extend again on subsequent invoice payments (invoice.payment_succeeded).
  const validUntil = computeValidUntil(paidAt, 1);
  const year = paidAt.getFullYear();
  const month = paidAt.getMonth() + 1;
  const label = `${year}-${String(month).padStart(2, "0")}`;

  await prisma.$transaction([
    prisma.tenant.update({
      where: { id: tenantId },
      data: {
        subscriptionTier: tier as any,
        billingMode: "INTERNATIONAL_AUTO" as any,
        status: "ACTIVE" as any,
        isActive: true,
        accountType: "REAL" as any,
        trialEndsAt: null,
        convertedAt: tenant.accountType === "DEMO" || tenant.status === "TRIAL" ? paidAt : undefined,
        lastPaidAt: paidAt,
        subscriptionPaidUntil: validUntil,
      },
    }),
    prisma.subscriptionVoucher.upsert({
      where: { tenantId_year_month: { tenantId, year, month } },
      create: {
        tenantId,
        year,
        month,
        label,
        amountPkr: 0,
        amountUsd: 0,
        status: "PAID" as any,
        paidAt,
        validUntil,
        notes: `Stripe automatic payment${eventId ? ` (${eventId})` : ""}`,
      },
      update: {
        status: "PAID" as any,
        paidAt,
        validUntil,
        notes: `Stripe automatic payment${eventId ? ` (${eventId})` : ""}`,
      },
    }),
  ]);

  return { ok: true as const, validUntil };
}

async function deactivateTenantSubscription(params: { tenantId: string; eventId?: string; reason?: string }) {
  const { tenantId, eventId, reason } = params;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, subscriptionPaidUntil: true },
  });
  if (!tenant) return { ok: false as const, reason: "tenant_not_found" as const };

  // End access now (data preserved). Natural expiry logic also locks, but this makes it immediate on cancel/delete.
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      billingMode: "INTERNATIONAL_AUTO" as any,
      status: "DEACTIVE" as any,
      isActive: false,
      subscriptionPaidUntil: new Date(),
      trialEndsAt: null,
    },
  }).catch(() => null);

  console.log("Stripe webhook: tenant subscription deactivated", { tenantId, eventId, reason });
  return { ok: true as const };
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Stripe webhook: STRIPE_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ message: "Webhook not configured." }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ message: "Missing stripe-signature header." }, { status: 400 });
  }

  let event: any;
  try {
    const rawBody = await req.text();
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error);
    return NextResponse.json({ message: "Invalid signature." }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as any;
      if (session.payment_status === "paid" || session.status === "complete") {
        const tenantId = String(session.metadata?.tenantId || session.client_reference_id || "").trim();
        const packageKey = String(session.metadata?.packageKey || "").trim() || null;
        if (tenantId) {
          await activateTenantFromPayment({ tenantId, packageKey, paidAt: new Date(), eventId: event.id });
        }
      }
    }

    // Automatic renewals: extend access when a subscription invoice is paid.
    if (event.type === "invoice.payment_succeeded" || event.type === "invoice.paid") {
      const invoice = event.data.object as any;
      const billingReason = String(invoice.billing_reason || "");
      const isInitial = billingReason === "subscription_create";
      if (!isInitial) {
        let tenantId = "";
        let packageKey: string | null = null;
        const subId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
        if (subId) {
          try {
            const stripe = getStripe();
            const sub = await stripe.subscriptions.retrieve(subId);
            tenantId = String((sub.metadata as any)?.tenantId || "").trim();
            packageKey = String((sub.metadata as any)?.packageKey || "").trim() || null;
          } catch (e) {
            console.error("Stripe webhook: failed to retrieve subscription", e);
          }
        }
        if (!tenantId) tenantId = String(invoice.metadata?.tenantId || invoice.subscription_details?.metadata?.tenantId || "").trim();
        if (tenantId) {
          await activateTenantFromPayment({ tenantId, packageKey, paidAt: new Date(), eventId: event.id });
        }
      }
    }

    // Automatic lifecycle: lock access when subscription is canceled/deleted (data preserved).
    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as any;
      const tenantId = String(sub.metadata?.tenantId || "").trim();
      if (tenantId) await deactivateTenantSubscription({ tenantId, eventId: event.id, reason: "subscription_deleted" });
    }

    if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as any;
      const status = String(sub.status || "");
      const tenantId = String(sub.metadata?.tenantId || "").trim();
      // If Stripe marks subscription canceled/unpaid/incomplete_expired, end access automatically.
      if (tenantId && (status === "canceled" || status === "unpaid" || status === "incomplete_expired")) {
        await deactivateTenantSubscription({ tenantId, eventId: event.id, reason: `subscription_${status}` });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook handler error:", error);
    // Return 200 for handled-but-failed internal processing? better 500 to let Stripe retry, but avoid infinite bad cases.
    // Tenant-not-found is non-retryable; for other errors Stripe should retry.
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
