import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Barcode,
  Boxes,
  Check,
  Clock3,
  CreditCard,
  Headphones,
  KeyRound,
  Layers,
  Mail,
  MapPin,
  Paintbrush,
  Phone,
  Pill,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Truck,
  Tv,
  Users,
  WifiOff,
  Wrench,
  Zap,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { getSession, isPlatformAdmin } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OmniPos Hub — Smart POS & Inventory for Pakistani shops",
  description:
    "Multi-tenant POS, inventory and billing SaaS for medical stores, mobile accessories, electronics, paint, cosmetics and hardware shops. Bulk stock + IMEI/Serial tracking, printable invoices and PKR packages from 5,000 to 25,000.",
};

const INDUSTRIES = [
  {
    key: "pharmacy",
    label: "Medical Stores",
    icon: Pill,
    blurb: "Batch & expiry, prescription sales and fast counter billing for pharmacies.",
    tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  },
  {
    key: "mobile",
    label: "Mobile Accessories",
    icon: Smartphone,
    blurb: "IMEI/Serial tracking, warranties, installments and repair job cards.",
    tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
  },
  {
    key: "paint-shop",
    label: "Paint Shops",
    icon: Paintbrush,
    blurb: "Shade codes, mixing formulas, pack sizes and supplier credit ledger.",
    tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  },
  {
    key: "cosmetics-shop",
    label: "Cosmetics",
    icon: Sparkles,
    blurb: "Variants & shades, batch/expiry alerts and beautiful retail checkout.",
    tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  },
  {
    key: "electronics",
    label: "Electronics Shops",
    icon: Tv,
    blurb: "Serial/warranty ledger, installments and service workflows for gadgets.",
    tone: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  },
  {
    key: "hardware-shop",
    label: "Hardware Shops",
    icon: Wrench,
    blurb: "Units & measurements, bulk items, barcode billing and stock control.",
    tone: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  },
] as const;

const CORE_FEATURES = [
  { icon: ReceiptText, title: "POS & printable invoices", text: "Counter billing with cash/card, auto-print receipts and sales history." },
  { icon: Boxes, title: "Bulk quantity stock", text: "Always included — add stock in bulk for every product and every industry." },
  { icon: Layers, title: "Brands & categories", text: "Organise your catalogue with brands, categories and product photos." },
  { icon: ShieldCheck, title: "Secure multi-tenant login", text: "Signed HttpOnly sessions, scrypt password hashing and per-business isolation." },
];

const OPTIONAL_FEATURES = [
  { icon: KeyRound, title: "IMEI / Serial tracking", text: "Track high-value units individually with scanner-first checkout." },
  { icon: Barcode, title: "Fast barcode billing", text: "Scanner-first flow for busy counters with hundreds of small items." },
  { icon: Clock3, title: "Batch & expiry", text: "Near-expiry alerts and batch records for medicines and cosmetics." },
  { icon: Truck, title: "Supplier ledger", text: "Record purchases and keep a running payable balance per supplier." },
  { icon: BarChart3, title: "Advanced analytics", text: "Profit, best sellers, top brands and sales trends on your overview." },
  { icon: WifiOff, title: "Offline sync", text: "Keep selling when the internet drops; sales sync when you reconnect." },
  { icon: Users, title: "Staff accounts & roles", text: "Add manager/cashier logins with restricted access for your team." },
  { icon: CreditCard, title: "Installments", text: "Sell high-value items on installments with simple repayment tracking." },
];

const PACKAGES = [
  {
    key: "starter",
    name: "Starter",
    price: 5000,
    tagline: "For a single counter finding its rhythm.",
    highlight: false,
    features: [
      "POS, invoices & sales history",
      "Bulk quantity stock",
      "Brands & categories",
      "1 owner login",
      "Email support",
    ],
    excluded: ["IMEI / Serial tracking", "Offline sync"],
  },
  {
    key: "pro",
    name: "Growth",
    price: 15000,
    tagline: "For busy shops that need deeper workflows.",
    highlight: true,
    features: [
      "Everything in Starter",
      "IMEI / Serial tracking & warranty",
      "Batch & expiry + barcode billing",
      "Supplier ledger & discounts",
      "Advanced analytics",
      "Up to 3 staff logins",
      "Priority WhatsApp support",
    ],
    excluded: ["Installment sales", "Offline sync"],
  },
  {
    key: "enterprise",
    name: "Pro",
    price: 25000,
    tagline: "Full power for high-volume, multi-staff shops.",
    highlight: false,
    features: [
      "Everything in Growth",
      "Installment sales",
      "Repair & service job cards",
      "Offline sync",
      "Unlimited staff accounts & roles",
      "Multi-unit & measurement selling",
      "Dedicated support",
    ],
    excluded: [],
  },
] as const;

function formatPkr(n: number) {
  return `PKR ${n.toLocaleString("en-PK")}`;
}

export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  if (session) {
    if (isPlatformAdmin(session.role)) redirect("/dashboard");
    if (session.tenantId) redirect(`/store/${session.tenantId}`);
  }

  let platformName = "OmniPos Hub";
  let platformLogo: string | null = null;
  try {
    const row = await (prisma as any).platformSetting.findUnique({ where: { id: "default" } });
    if (row?.platformName) platformName = row.platformName;
    platformLogo = row?.platformLogoDataUrl ?? null;
  } catch {
    /* defaults are fine on a fresh database */
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {platformLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={platformLogo} alt="" className="h-9 w-9 rounded-lg border border-line object-contain" />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-fg">
                <Store className="h-5 w-5" aria-hidden />
              </span>
            )}
            <span className="text-base font-semibold tracking-tight">{platformName}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            <a href="#industries" className="hover:text-foreground">Industries</a>
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#packages" className="hover:text-foreground">Packages</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="focus-ring rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:border-line-strong">
              Login
            </Link>
            <Link href="/signup" className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
              Sign up
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-accent-soft opacity-70 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -right-32 top-24 h-[360px] w-[360px] rounded-full bg-accent-soft opacity-40 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                <Zap className="h-3.5 w-3.5" aria-hidden />
                Built for Pakistani shops · PKR billing
              </span>
              <h1 className="mt-5 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                One POS for your counter,
                <span className="block text-accent">one dashboard for your stock.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                {platformName} gives every business its own secure panel — bulk quantity stock, optional IMEI/Serial
                tracking, printable invoices and industry workflows for medical, mobile, paint, cosmetics, electronics
                and hardware shops.
              </p>
              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
                <Link href="/signup" className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
                  Start 7-day free trial
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a href="#packages" className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold hover:border-line-strong">
                  View packages
                </a>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> No card required</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> Data preserved after trial</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> Local support</span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-panel sm:p-5">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"><ReceiptText className="h-4 w-4" aria-hidden /></span>
                    <div>
                      <p className="text-sm font-semibold">Counter sale</p>
                      <p className="text-[11px] text-muted">Invoice INV-2841 · Cash</p>
                    </div>
                  </div>
                  <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Paid</span>
                </div>
                <div className="space-y-2.5 py-3 text-sm">
                  {[
                    ["Anker USB-C Cable", "Bulk stock", "1,250"],
                    ["AirPods Pro 2", "IMEI · SN A2K9", "58,000"],
                    ["Tempered Glass", "Bulk stock", "450"],
                  ].map(([name, meta, price]) => (
                    <div key={name} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{name}</p>
                        <p className="text-[11px] text-muted">{meta}</p>
                      </div>
                      <p className="shrink-0 text-[13px] font-semibold tabular-nums">{formatPkr(Number(price))}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-sm text-muted">Total</span>
                  <span className="text-lg font-semibold text-accent">{formatPkr(59700)}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { icon: Boxes, label: "Bulk stock" },
                    { icon: KeyRound, label: "IMEI/Serial" },
                    { icon: ReceiptText, label: "Invoice" },
                  ].map(({ icon: Icon, label }) => (
                    <div key={label} className="rounded-lg border border-line bg-surface-2 px-2 py-2">
                      <Icon className="mx-auto h-4 w-4 text-accent" aria-hidden />
                      <p className="mt-1 text-[10px] font-medium text-muted">{label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Industries */}
        <section id="industries" className="border-b border-line bg-surface-2/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Built for your industry</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">One platform, six tailored panels</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                Every business gets its own panel with the workflows of its trade. Bulk quantity stock is always on —
                optional features are switched on per business by the platform admin.
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {INDUSTRIES.map(({ key, label, icon: Icon, blurb, tone }) => (
                <div key={key} className="rounded-xl border border-line bg-surface p-4">
                  <span className={`inline-flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{label}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{blurb}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Everything at the counter</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Core features on every plan</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                Sell, print and track stock from day one. No hidden setup fees.
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {CORE_FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-line bg-surface p-4">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                    <Icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-3 text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>

            <div className="mt-12 max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Grow when you need</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Optional access, one checkbox at a time</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                Turn features on for a business and the full workflow appears in their panel. Turn it off and it is
                removed — cleanly, per business.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {OPTIONAL_FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-line bg-surface-2/50 p-4">
                  <Icon className="h-5 w-5 text-accent" aria-hidden />
                  <h3 className="mt-2.5 text-sm font-semibold">{title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Packages */}
        <section id="packages" className="border-b border-line bg-surface-2/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Simple PKR packages</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Pick the access your shop needs</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                Monthly pricing in Pakistani Rupees. Every package starts with a free 7-day trial.
              </p>
            </div>

            <div className="mt-9 grid gap-4 lg:grid-cols-3">
              {PACKAGES.map((pkg) => (
                <div
                  key={pkg.key}
                  className={
                    pkg.highlight
                      ? "relative rounded-2xl border-2 border-accent bg-surface p-5 shadow-panel"
                      : "relative rounded-2xl border border-line bg-surface p-5"
                  }
                >
                  {pkg.highlight ? (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-fg">
                      Most popular
                    </span>
                  ) : null}
                  <h3 className="text-lg font-semibold">{pkg.name}</h3>
                  <p className="mt-1 min-h-[40px] text-sm text-muted">{pkg.tagline}</p>
                  <div className="mt-4 flex items-end gap-1">
                    <span className="text-3xl font-semibold tracking-tight">{formatPkr(pkg.price)}</span>
                    <span className="pb-1 text-sm text-muted">/month</span>
                  </div>
                  <Link
                    href={`/signup?package=${pkg.key}`}
                    className={
                      pkg.highlight
                        ? "focus-ring mt-5 flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover"
                        : "focus-ring mt-5 flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-semibold hover:border-line-strong"
                    }
                  >
                    Start free trial
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <ul className="mt-5 space-y-2 text-sm">
                    {pkg.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                        <span>{feature}</span>
                      </li>
                    ))}
                    {pkg.excluded.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-muted">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-muted" aria-hidden>—</span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="mt-6 flex items-center justify-center gap-2 text-center text-xs text-muted">
              <BadgeCheck className="h-4 w-4 text-emerald-500" aria-hidden />
              All packages include secure login, daily backups and data isolation. Prices exclude applicable taxes.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Live in minutes</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">From signup to first invoice</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                  Create your account, choose your industry and start adding stock. Your 7-day trial includes the
                  recommended features for your trade — convert to a paid package whenever you are ready.
                </p>
                <Link href="/signup" className="focus-ring mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
                  Create my shop account
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <ol className="space-y-3">
                {[
                  { n: "01", title: "Create your business", text: "Enter shop name, phone, location and choose one of the six industries." },
                  { n: "02", title: "Recommended access is on", text: "We enable the features your industry needs. The admin can adjust them anytime." },
                  { n: "03", title: "Add stock & sell", text: "Add bulk quantity products, or serial/IMEI units when that feature is granted." },
                  { n: "04", title: "Print & grow", text: "Checkout prints a receipt automatically and your dashboard tracks sales and stock." },
                ].map((step) => (
                  <li key={step.n} className="flex gap-3 rounded-xl border border-line bg-surface p-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-xs font-bold text-accent">{step.n}</span>
                    <div>
                      <p className="text-sm font-semibold">{step.title}</p>
                      <p className="mt-0.5 text-sm text-muted">{step.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="bg-surface-2/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Talk to a human</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Need help choosing a package?</h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
                  Tell us about your shop and we will recommend the right features. Onboarding, data setup and staff
                  training are available for all paid packages.
                </p>
                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <a href="tel:+923001234567" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
                    <Phone className="h-4 w-4" aria-hidden />
                    +92 300 1234567
                  </a>
                  <a href="mailto:support@omniposhub.pk" className="focus-ring inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold hover:border-line-strong">
                    <Mail className="h-4 w-4" aria-hidden />
                    support@omniposhub.pk
                  </a>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Headphones, title: "Sales & onboarding", text: "Guidance on packages, industries and feature access." },
                  { icon: Phone, title: "WhatsApp support", text: "Mon–Sat, 10am–8pm PKT for paid businesses." },
                  { icon: MapPin, title: "Based in Pakistan", text: "Karachi · Lahore · Islamabad remote onboarding." },
                  { icon: ShieldCheck, title: "Secure by design", text: "Per-business data isolation and signed sessions." },
                ].map(({ icon: Icon, title, text }) => (
                  <div key={title} className="rounded-xl border border-line bg-surface p-4">
                    <Icon className="h-5 w-5 text-accent" aria-hidden />
                    <p className="mt-2 text-sm font-semibold">{title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            {platformLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={platformLogo} alt="" className="h-8 w-8 rounded-md border border-line object-contain" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-fg"><Store className="h-4 w-4" aria-hidden /></span>
            )}
            <div>
              <p className="text-sm font-semibold">{platformName}</p>
              <p className="text-xs text-muted">POS · Inventory · Billing for Pakistani shops</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
            <Link href="/login" className="hover:text-foreground">Login</Link>
            <Link href="/signup" className="hover:text-foreground">Sign up</Link>
            <a href="#packages" className="hover:text-foreground">Packages</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
            <span>© {new Date().getFullYear()} {platformName}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
