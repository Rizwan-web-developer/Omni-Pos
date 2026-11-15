import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { requireTenantAccess } from "@/lib/auth/server";
import { toPlanTier } from "@/lib/mappers";
import { getStripe, isInternationalBillingCountry, isStripeConfigured, packageByKey, priceIdForPackage } from "@/lib/stripe";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tenantId = String(body?.tenantId ?? "").trim();
    const packageKey = String(body?.package ?? "").trim().toLowerCase();

    if (!tenantId) return NextResponse.json({ message: "Business is required." }, { status: 400 });
    const pkg = packageByKey(packageKey);
    if (!pkg) return NextResponse.json({ message: "Choose a valid package." }, { status: 400 });

    const access = await requireTenantAccess(tenantId);
    if (!access) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // Only the business owner (or platform admin) can start subscription checkout.
    if (!access.admin && String(access.session.role) !== "OWNER") {
      return NextResponse.json({ message: "Only the business owner can upgrade the subscription." }, { status: 403 });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, businessName: true, email: true, country: true, slug: true },
    });
    if (!tenant) return NextResponse.json({ message: "Business not found." }, { status: 404 });

    if (!isInternationalBillingCountry(tenant.country)) {
      return NextResponse.json({
        message: "Online Stripe billing is available for international regions. Pakistan accounts use manual billing — please contact support/admin to renew.",
      }, { status: 400 });
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({
        message: "Online billing is not configured yet. Please contact support.",
      }, { status: 503 });
    }

    const priceId = priceIdForPackage(pkg.key);
    if (!priceId) {
      return NextResponse.json({
        message: "This package is not configured for online billing yet. Please contact support.",
      }, { status: 503 });
    }

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;
    const successUrl = `${origin}/store/${tenantId}/upgrade?success=1&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/store/${tenantId}/upgrade?canceled=1`;

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: tenant.email || undefined,
      client_reference_id: tenantId,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      metadata: {
        tenantId,
        packageKey: pkg.key,
        subscriptionTier: toPlanTier(pkg.key),
        businessName: tenant.businessName || "",
      },
      subscription_data: {
        metadata: {
          tenantId,
          packageKey: pkg.key,
          subscriptionTier: toPlanTier(pkg.key),
        },
      },
    });

    if (!session.url) {
      return NextResponse.json({ message: "Could not start checkout. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json({ message: "Could not start online checkout. Please try again." }, { status: 500 });
  }
}
