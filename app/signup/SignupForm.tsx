"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Store,
  User,
} from "lucide-react";

import { INDUSTRIES } from "@/lib/data";
import type { IndustryKey } from "@/lib/types";
import { cn } from "@/lib/utils";

const ALLOWED_INDUSTRIES: IndustryKey[] = [
  "pharmacy",
  "mobile",
  "paint-shop",
  "cosmetics-shop",
  "electronics",
  "hardware-shop",
];

const PACKAGES = [
  { key: "starter", label: "Starter", price: "PKR 5,000/mo" },
  { key: "pro", label: "Growth", price: "PKR 15,000/mo" },
  { key: "enterprise", label: "Pro", price: "PKR 25,000/mo" },
] as const;

const INDUSTRY_LABEL: Record<string, string> = {
  pharmacy: "Medical Stores",
  mobile: "Mobile Accessories",
  "paint-shop": "Paint Shops",
  "cosmetics-shop": "Cosmetics",
  electronics: "Electronics Shops",
  "hardware-shop": "Hardware Shops",
};

function fieldClass(hasError: boolean): string {
  return cn(
    "focus-ring h-11 w-full rounded-lg border bg-surface px-3 text-sm text-foreground placeholder:text-muted",
    hasError ? "border-rose-500/60" : "border-line",
  );
}

export function SignupForm() {
  const router = useRouter();
  const search = useSearchParams();
  const initialPackage = search.get("package");
  const [form, setForm] = useState({
    name: "",
    ownerName: "",
    email: "",
    phone: "",
    location: "",
    industry: "pharmacy" as IndustryKey,
    package: PACKAGES.some((pkg) => pkg.key === initialPackage) ? (initialPackage as string) : "pro",
    password: "",
    confirm: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [platformName, setPlatformName] = useState("OmniPos Hub");
  const [platformLogo, setPlatformLogo] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/platform/settings", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json().catch(() => ({}))) as { platformName?: string; platformLogoDataUrl?: string | null };
        if (cancelled) return;
        if (data.platformName) setPlatformName(data.platformName);
        setPlatformLogo(data.platformLogoDataUrl ?? null);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = (next: Partial<typeof form>) => setForm((current) => ({ ...current, ...next }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 10 || !/[A-Z]/.test(form.password) || !/[a-z]/.test(form.password) || !/[0-9]/.test(form.password)) {
      setError("Password must be 10+ characters with upper case, lower case and a number.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          ownerName: form.ownerName,
          email: form.email,
          phone: form.phone,
          location: form.location,
          industry: form.industry,
          package: form.package,
          password: form.password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; redirectTo?: string };
      if (!res.ok) throw new Error(data.message || "Signup failed.");
      router.push(data.redirectTo || "/login");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto grid min-h-dvh max-w-6xl gap-0 px-4 py-6 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-10 lg:py-10">
        <aside className="hidden lg:flex lg:flex-col lg:justify-between lg:rounded-2xl lg:border lg:border-line lg:bg-surface lg:p-7">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg bg-accent text-accent-fg">
                {platformLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={platformLogo} alt="" className="h-full w-full object-contain" />
                ) : (
                  <Store className="h-5 w-5" aria-hidden />
                )}
              </span>
              <span className="text-base font-semibold tracking-tight">{platformName}</span>
            </Link>
            <h1 className="mt-8 text-2xl font-semibold tracking-tight">Start your 7-day free trial</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Your own secure shop panel with bulk quantity stock, POS, printable invoices and the features recommended
              for your industry.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "No card required for the trial",
                "Bulk quantity stock always included",
                "IMEI/Serial tracking for the right trades",
                "Data preserved when you convert to paid",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-3 w-3" aria-hidden />
                  </span>
                  <span className="text-muted">{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-accent" aria-hidden /> Secure by design</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              Signed HttpOnly sessions, scrypt password hashing and per-business data isolation.
            </p>
          </div>
        </aside>

        <main className="flex items-center justify-center">
          <div className="w-full max-w-xl">
            <div className="mb-5 flex items-center justify-between gap-3 lg:hidden">
              <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-foreground">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Home
              </Link>
              <Link href="/login" className="text-sm font-medium text-accent hover:underline">Login</Link>
            </div>

            <div className="rounded-2xl border border-line bg-surface p-5 shadow-panel sm:p-7">
              <h2 className="text-xl font-semibold tracking-tight">Create your business account</h2>
              <p className="mt-1 text-sm text-muted">Takes about a minute. Trial is active immediately.</p>

              {error ? (
                <div role="alert" className="mt-4 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 text-sm text-rose-700 dark:text-rose-300">
                  {error}
                </div>
              ) : null}

              <form onSubmit={onSubmit} autoComplete="off" className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="signup-name" className="mb-1.5 block text-sm font-medium">Business name <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                      <input id="signup-name" required value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Al Madina Medical Store" className={cn(fieldClass(false), "pl-9")} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="signup-owner" className="mb-1.5 block text-sm font-medium">Owner name</label>
                    <div className="relative">
                      <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                      <input id="signup-owner" value={form.ownerName} onChange={(e) => patch({ ownerName: e.target.value })} placeholder="Your name" className={cn(fieldClass(false), "pl-9")} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="signup-phone" className="mb-1.5 block text-sm font-medium">Phone <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                      <input id="signup-phone" type="tel" required value={form.phone} onChange={(e) => patch({ phone: e.target.value })} placeholder="+92 300 1234567" className={cn(fieldClass(false), "pl-9")} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="signup-email" className="mb-1.5 block text-sm font-medium">Email (login) <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                      <input id="signup-email" type="email" required value={form.email} onChange={(e) => patch({ email: e.target.value })} placeholder="you@shop.com" autoComplete="off" className={cn(fieldClass(false), "pl-9")} />
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="signup-location" className="mb-1.5 block text-sm font-medium">Location <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                      <input id="signup-location" required value={form.location} onChange={(e) => patch({ location: e.target.value })} placeholder="City, Pakistan" className={cn(fieldClass(false), "pl-9")} />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 block text-sm font-medium">Business category <span className="text-rose-500">*</span></p>
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Business category">
                    {ALLOWED_INDUSTRIES.map((key) => {
                      const industry = INDUSTRIES.find((item) => item.key === key);
                      const selected = form.industry === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => patch({ industry: key })}
                          className={cn(
                            "focus-ring flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition-colors",
                            selected ? "border-accent-line bg-accent-soft text-foreground" : "border-line bg-surface-2 text-muted hover:border-line-strong",
                          )}
                        >
                          <span>{INDUSTRY_LABEL[key] ?? industry?.label ?? key}</span>
                          {selected ? <Check className="h-4 w-4 text-accent" aria-hidden /> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-1.5 block text-sm font-medium">Package</p>
                  <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Package">
                    {PACKAGES.map((pkg) => {
                      const selected = form.package === pkg.key;
                      return (
                        <button
                          key={pkg.key}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => patch({ package: pkg.key })}
                          className={cn(
                            "focus-ring rounded-lg border px-3 py-2 text-left transition-colors",
                            selected ? "border-accent-line bg-accent-soft" : "border-line bg-surface-2 hover:border-line-strong",
                          )}
                        >
                          <span className="block text-sm font-semibold">{pkg.label}</span>
                          <span className="block text-xs text-muted">{pkg.price}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-xs text-muted">Trial starts on the Growth feature set. You can change the package after the trial.</p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="signup-password" className="mb-1.5 block text-sm font-medium">Password <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                      <input id="signup-password" type="password" required value={form.password} onChange={(e) => patch({ password: e.target.value })} placeholder="10+ chars, A-z + 0-9" autoComplete="new-password" className={cn(fieldClass(false), "pl-9")} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="signup-confirm" className="mb-1.5 block text-sm font-medium">Confirm password <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                      <input id="signup-confirm" type="password" required value={form.confirm} onChange={(e) => patch({ confirm: e.target.value })} placeholder="Repeat password" autoComplete="new-password" className={cn(fieldClass(false), "pl-9")} />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="focus-ring flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {loading ? "Creating your shop…" : "Create account & start trial"}
                  {!loading ? <ArrowRight className="h-4 w-4" aria-hidden /> : null}
                </button>
              </form>

              <p className="mt-4 text-center text-sm text-muted">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-accent hover:underline">Sign in</Link>
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
