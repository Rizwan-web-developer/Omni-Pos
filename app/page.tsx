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
  Package,
  Phone,
  ReceiptText,
  RefreshCw,
  ScanBarcode,
  ShieldCheck,
  Store,
  Truck,
  Users,
  WifiOff,
  Wrench,
  Zap,
} from "lucide-react";

import { prisma } from "@/lib/db";
import { getSession, isPlatformAdmin } from "@/lib/auth/server";
import { BRAND_NAME, CONTACT_EMAIL, CONTACT_WHATSAPP_DISPLAY, CONTACT_WHATSAPP_LINK } from "@/lib/brand";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `${BRAND_NAME} – POS & Stock Management for Every Business`,
  description:
    "Sell faster, track inventory, print invoices, and manage your team from one secure platform. Start a 7-day free trial with full access.",
};

const CORE_FEATURES = [
  { icon: ReceiptText, title: "POS & printable invoices", text: "Fast counter billing with cash/card, automatic receipts, and complete sales history." },
  { icon: Boxes, title: "Bulk quantity stock", text: "Always included — manage stock quantities for every product in every business." },
  { icon: Layers, title: "Brands & categories", text: "Organize your catalog with brands, categories, and product photos." },
  { icon: ShieldCheck, title: "Secure access", text: "Signed sessions, strong password hashing, and per-business data isolation." },
];

const OPTIONAL_FEATURES = [
  { icon: KeyRound, title: "IMEI / Serial tracking", text: "Track high-value units individually with serial/IMEI selection at checkout." },
  { icon: ScanBarcode, title: "Fast barcode billing", text: "Scan barcodes to add products instantly at busy counters." },
  { icon: Clock3, title: "Batch & expiry", text: "Batch records, expiry dates, and alerts to prevent selling expired stock." },
  { icon: BadgeCheck, title: "Prescription sales", text: "Mark prescription items and capture doctor/Rx details at checkout." },
  { icon: Package, title: "Shades, units & measurements", text: "Sell by shade, pack size, or custom units (kg, litre, foot, and more)." },
  { icon: CreditCard, title: "Discounts & installments", text: "Apply discounts and take down payments with a clear balance due." },
  { icon: Wrench, title: "Service & repair jobs", text: "Create job cards, track status, and record service items without stock deduction." },
  { icon: Truck, title: "Supplier ledger", text: "Record purchases and payments with a running payable balance per supplier." },
  { icon: BarChart3, title: "Advanced analytics", text: "Sales trends, totals, and business insights on your overview." },
  { icon: WifiOff, title: "Offline sync", text: "Keep selling when the internet drops; sales sync automatically when reconnected." },
  { icon: Users, title: "Staff accounts & roles", text: "Add manager/cashier logins with controlled access for your team." },
  { icon: RefreshCw, title: "Data always preserved", text: "Your business data stays safe — upgrade anytime to continue." },
];

const PACKAGES = [
  {
    key: "starter",
    name: "Starter",
    price: 35,
    tagline: "For a single counter getting started.",
    highlight: false,
    features: [
      "POS, invoices & sales history",
      "Bulk quantity stock",
      "Brands & categories",
      "1 owner login",
      "Core reports",
      "Email support",
    ],
  },
  {
    key: "pro",
    name: "Growth",
    price: 65,
    tagline: "For busy businesses that need deeper workflows.",
    highlight: true,
    features: [
      "Everything in Starter",
      "IMEI / Serial tracking & warranty",
      "Batch & expiry + barcode billing",
      "Discounts, prescriptions & installments",
      "Supplier ledger",
      "Advanced analytics",
      "Up to 3 staff logins",
      "Priority support",
    ],
  },
  {
    key: "marketing-agency",
    name: "Marketing Agency",
    price: 95,
    tagline: "Full power for high-volume, multi-staff operations.",
    highlight: false,
    features: [
      "Everything in Growth",
      "Repair & service job cards",
      "Offline sync",
      "Unlimited staff accounts & roles",
      "Multi-unit & measurement selling",
      "All optional workflows enabled",
      "Dedicated support",
    ],
  },
] as const;

export default async function LandingPage() {
  const session = await getSession().catch(() => null);
  if (session) {
    if (isPlatformAdmin(session.role)) redirect("/dashboard");
    if (session.tenantId) redirect(`/store/${session.tenantId}`);
  }

  let platformName = BRAND_NAME;
  let platformLogo: string | null = "/logo.png";
  try {
    const row = await (prisma as any).platformSetting.findUnique({ where: { id: "default" } });
    const rawName = row?.platformName || BRAND_NAME;
    platformName = rawName;
    platformLogo = row?.platformLogoDataUrl ?? "/logo.png";
  } catch {
    /* defaults are fine */
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            {platformLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={platformLogo} alt={platformName} className="h-12 w-12 rounded-lg border border-line bg-white object-contain p-0.5" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-fg">
                <Store className="h-6 w-6" aria-hidden />
              </span>
            )}
            <span className="text-base font-semibold tracking-tight">{platformName}</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#packages" className="hover:text-foreground">Packages</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="focus-ring rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium hover:border-line-strong">
              Login
            </Link>
            <Link href="/signup" className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
              Start free trial
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-line">
          <div className="pointer-events-none absolute -left-40 top-0 h-[420px] w-[420px] rounded-full bg-accent-soft opacity-70 blur-3xl" aria-hidden />
          <div className="pointer-events-none absolute -right-32 top-24 h-[360px] w-[360px] rounded-full bg-accent-soft opacity-40 blur-3xl" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent-line bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
                <Zap className="h-3.5 w-3.5" aria-hidden />
                POS & stock management for local and international businesses
              </span>
              <h1 className="mt-5 text-[34px] font-semibold leading-[1.1] tracking-tight sm:text-5xl">
                Run your counter and stock
                <span className="block text-accent">from one simple platform.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                {platformName} helps any business sell faster, track inventory, print invoices, and manage staff — with bulk stock always included and powerful workflows you can enable when you need them.
              </p>
              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
                <Link href="/signup" className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
                  Start your 7-day free trial
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <a href="#packages" className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold hover:border-line-strong">
                  View packages
                </a>
              </div>
                <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> 7-day free trial with full access</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> No card required</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> Your data stays preserved</span>
                <span className="inline-flex items-center gap-1.5"><Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden /> Local & international support</span>
              </div>
            </div>

            <div className="relative">
              <div className="rounded-2xl border border-line bg-surface p-4 shadow-panel sm:p-5">
                <div className="flex items-center justify-between border-b border-line pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent"><ReceiptText className="h-4 w-4" aria-hidden /></span>
                    <div>
                      <p className="text-sm font-semibold">Counter sale</p>
                      <p className="text-[11px] text-muted">Invoice #2841 · Cash</p>
                    </div>
                  </div>
                  <span className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Paid</span>
                </div>
                <div className="space-y-2.5 py-3 text-sm">
                  {[
                    ["USB-C Cable", "Bulk stock · Qty 2", "$18.00"],
                    ["Wireless Earbuds", "Serial tracked unit", "$129.00"],
                    ["Screen Protector", "Bulk stock · Qty 1", "$8.50"],
                  ].map(([name, meta, price]) => (
                    <div key={name} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{name}</p>
                        <p className="text-[11px] text-muted">{meta}</p>
                      </div>
                      <p className="shrink-0 text-[13px] font-semibold tabular-nums">{price}</p>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3">
                  <span className="text-sm text-muted">Total</span>
                  <span className="text-lg font-semibold text-accent">$155.50</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  {[
                    { icon: Boxes, label: "Bulk stock" },
                    { icon: KeyRound, label: "Serial units" },
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

        <section id="features" className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">For your business</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">POS and stock management, ready for any business</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                One platform for sales, inventory, invoices, and team operations. Core tools are included on every plan — and you can unlock advanced workflows as your business grows.
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
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">All features available</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Everything you need, when you need it</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                Enable the workflows that fit your business. Every feature below is included in the 7-day free trial with full access.
              </p>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {OPTIONAL_FEATURES.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-line bg-surface-2/50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                      <Icon className="h-4 w-4" aria-hidden />
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">{title}</h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted">{text}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="packages" className="border-b border-line bg-surface-2/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Simple packages</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Choose the plan that fits your business</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                Monthly pricing in USD. Every plan starts with a <strong className="text-foreground">7-day free trial with full access</strong> — try every feature before you subscribe.
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
                    <span className="text-3xl font-semibold tracking-tight">${pkg.price}</span>
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
                    Start your free trial
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <ul className="mt-5 space-y-2 text-sm">
                    {pkg.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mx-auto mt-6 max-w-3xl rounded-xl border border-line bg-surface p-4 text-center text-sm text-muted">
              <p><strong className="text-foreground">7-day free trial:</strong> full access to every feature. After 7 days, upgrade to keep selling, adding stock, and using your account — your data remains preserved.</p>
            </div>
          </div>
        </section>

        <section className="border-b border-line">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Get started quickly</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">From signup to first invoice</h2>
                <p className="mt-3 text-sm leading-relaxed text-muted sm:text-base">
                  Create your account, verify your email, and start selling. Your trial includes full access so you can explore every workflow for your business.
                </p>
                <Link href="/signup" className="focus-ring mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
                  Create my account
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
              <ol className="space-y-3">
                {[
                  { n: "01", title: "Create your business", text: "Enter your business details and choose a package to start your 7-day free trial." },
                  { n: "02", title: "Verify your email", text: "Confirm your account with a secure one-time code sent to your email." },
                  { n: "03", title: "Full access during trial", text: "Use all features, add products and stock, and run your POS with no limitations for 7 days." },
                  { n: "04", title: "Upgrade to continue", text: "After the trial, upgrade to a paid plan to keep using your account. Your data stays preserved." },
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

        <section id="contact" className="bg-surface-2/40">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-accent">Contact</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Need help choosing a package?</h2>
                <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted sm:text-base">
                  Tell us about your business and we’ll help you get started. Support is available for both local and international clients.
                </p>
                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                  <a href={CONTACT_WHATSAPP_LINK} target="_blank" rel="noreferrer" className="focus-ring inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-accent-fg hover:bg-accent-hover">
                    <Phone className="h-4 w-4" aria-hidden />
                    WhatsApp: {CONTACT_WHATSAPP_DISPLAY}
                  </a>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="focus-ring inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-5 py-3 text-sm font-semibold hover:border-line-strong">
                    <Mail className="h-4 w-4" aria-hidden />
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  { icon: Headphones, title: "Sales & onboarding", text: "Help with packages, setup, and getting your business live." },
                  { icon: Phone, title: "WhatsApp support", text: "Quick help for questions and account assistance." },
                  { icon: ShieldCheck, title: "Secure by design", text: "Per-business data isolation, signed sessions, and protected APIs." },
                  { icon: BadgeCheck, title: "Data preserved", text: "Your information remains safe even if your trial or subscription expires." },
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
              <img src={platformLogo} alt="" className="h-12 w-12 rounded-md border border-line bg-white object-contain p-0.5" />
            ) : (
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-accent text-accent-fg"><Store className="h-6 w-6" aria-hidden /></span>
            )}
            <div>
              <p className="text-sm font-semibold">{platformName}</p>
              <p className="text-xs text-muted">POS & stock management for every business</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted">
            <Link href="/login" className="hover:text-foreground">Login</Link>
            <Link href="/signup" className="hover:text-foreground">Start free trial</Link>
            <a href="#packages" className="hover:text-foreground">Packages</a>
            <a href="#contact" className="hover:text-foreground">Contact</a>
            <span>© {new Date().getFullYear()} {platformName}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
