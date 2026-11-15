"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CreditCard, ExternalLink, Loader2, ShieldCheck } from "lucide-react";

import { cn, currencyForCountry, formatCurrency } from "@/lib/utils";

type Business = {
  id: string;
  businessName: string;
  country?: string | null;
  status?: string;
  accountType?: string;
  trialEndsAt?: string | null;
  subscriptionPaidUntil?: string | null;
  subscriptionTier?: string | null;
};

const PACKAGES = [
  {
    key: "starter",
    label: "Starter",
    price: 35,
    features: ["1 outlet", "POS & invoices", "Inventory & stock", "Email support"],
  },
  {
    key: "pro",
    label: "Growth",
    price: 65,
    highlighted: true,
    features: ["Up to 3 outlets", "Advanced reports", "Staff & roles", "Priority support"],
  },
  {
    key: "marketing-agency",
    label: "Marketing Agency",
    price: 95,
    features: ["Unlimited outlets", "Multi-location", "Full access", "Priority support"],
  },
] as const;

function isPaidActive(biz: Business | null): boolean {
  if (!biz) return false;
  if (String(biz.status) === "DEACTIVE") return false;
  if (biz.subscriptionPaidUntil) {
    const end = new Date(biz.subscriptionPaidUntil).getTime();
    if (Number.isFinite(end) && end > Date.now()) return true;
  }
  // Real + active treated as paid in admin billing; allow as active
  if (String(biz.accountType) === "REAL" && String(biz.status) === "ACTIVE") return true;
  return false;
}

export function UpgradeView({ businessId }: { businessId: string }) {
  const search = useSearchParams();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string>("pro");

  const success = search.get("success") === "1";
  const canceled = search.get("canceled") === "1";

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/businesses/${businessId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load business.");
      setBusiness(data.business ?? null);
      const tier = String(data.business?.subscriptionTier || "").toLowerCase();
      if (tier === "starter" || tier === "pro" || tier === "marketing_agency") {
        setSelected(tier === "marketing_agency" ? "marketing-agency" : tier);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load business.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const international = useMemo(() => {
    if (!business) return true;
    // No country set -> treat as international (Stripe) unless explicitly Pakistan in location; safer default.
    return currencyForCountry(business.country) !== "PKR";
  }, [business]);

  const paid = isPaidActive(business);

  const startCheckout = async () => {
    setBusy(selected);
    setError("");
    try {
      const res = await fetch("/api/billing/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: businessId, package: selected }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not start checkout.");
      if (data.url) {
        window.location.href = data.url as string;
        return;
      }
      throw new Error("Checkout URL was not returned.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start checkout.");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/store/${businessId}`} className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to store
        </Link>
        <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-foreground">Upgrade your plan</h1>
        <p className="mt-0.5 text-sm text-muted">Choose a package and pay securely with Stripe. Your panel upgrades automatically after payment.</p>
      </div>

      {success ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          <p className="font-semibold">Payment received</p>
          <p className="mt-0.5">Thanks! Your subscription is being activated. If your access is not updated yet, refresh in a moment.</p>
          <button type="button" onClick={() => void load()} className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground">Refresh status</button>
        </div>
      ) : null}
      {canceled ? (
        <div className="rounded-xl border border-line bg-surface-2 px-4 py-3 text-sm text-muted">Checkout was canceled. You can choose a package and try again anytime.</div>
      ) : null}
      {error ? <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</div> : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-12 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
      ) : !international ? (
        <div className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-base font-semibold text-foreground">Manual billing (Pakistan)</h2>
          <p className="mt-1 text-sm text-muted">Online Stripe checkout is available for international regions. Pakistan accounts are billed manually. Please contact support/admin to renew or upgrade your subscription.</p>
          <Link href={`/store/${businessId}/support`} className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">Contact support</Link>
        </div>
      ) : paid ? (
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Subscription active</h2>
          <p className="mt-1 text-sm text-muted">
            {business?.businessName} is active{business?.subscriptionPaidUntil ? ` until ${new Date(business.subscriptionPaidUntil).toLocaleString("en-US")}` : ""}.
          </p>
          <p className="mt-2 text-sm text-muted">You can still choose a package below to renew/continue your subscription via Stripe.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <p className="font-semibold">Trial or subscription ended</p>
          <p className="mt-0.5">Choose a package below to upgrade securely with Stripe and restore full access. Your data is preserved.</p>
        </div>
      )}

      {!loading && international ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {PACKAGES.map((pkg) => {
              const active = selected === pkg.key;
              return (
                <button
                  key={pkg.key}
                  type="button"
                  onClick={() => setSelected(pkg.key)}
                  className={cn(
                    "focus-ring relative rounded-xl border p-5 text-left transition-colors",
                    active ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:border-line-strong",
                    "highlighted" in pkg && pkg.highlighted && !active ? "ring-1 ring-accent/20" : "",
                  )}
                >
                  {"highlighted" in pkg && pkg.highlighted ? <span className="absolute right-3 top-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-fg">Popular</span> : null}
                  <p className="text-base font-semibold text-foreground">{pkg.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">${pkg.price}<span className="text-sm font-normal text-muted">/mo</span></p>
                  <ul className="mt-3 space-y-1.5">
                    {pkg.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-muted">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <span className={cn("mt-4 inline-flex rounded-md px-2.5 py-1 text-xs font-medium", active ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}>{active ? "Selected" : "Select"}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface p-4">
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void startCheckout()}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-fg disabled:opacity-60"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              {busy ? "Redirecting to Stripe…" : "Continue to Stripe checkout"}
              {!busy ? <ExternalLink className="h-4 w-4" aria-hidden /> : null}
            </button>
            <p className="text-xs text-muted">Secure payment by Stripe. You can choose/confirm the package on Stripe and your access will upgrade automatically after payment.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
