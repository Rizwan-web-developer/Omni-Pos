"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Copy,
  Info,
  KeyRound,
  Loader2,
  Rocket,
  Sparkles,
  X,
} from "lucide-react";

import { DialogShell } from "@/components/ui/DialogShell";
import { IndustryGlyph } from "@/components/ui/Badges";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useTenants } from "@/components/providers/TenantProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { INDUSTRIES, INDUSTRY_BY_KEY, PLAN_BY_KEY } from "@/lib/data";
import { FEATURES, FEATURE_GROUPS, recommendedFeatures } from "@/lib/features";
import type { AccountType, IndustryKey, PlanKey, Tenant, TenantDraft } from "@/lib/types";
import { cn, isValidEmail, isValidPhone, slugify } from "@/lib/utils";

const STEPS = [
  { label: "Business details", short: "01" },
  { label: "Category", short: "02" },
  { label: "Feature access", short: "03" },
] as const;

const EMPTY_DRAFT: TenantDraft = {
  name: "",
  email: "",
  phone: "",
  location: "",
  industry: "mobile",
  accountType: "real",
  password: "",
  plan: "starter",
  slug: "",
  owner: "",
};

const FIELD_ORDER = ["name", "email", "phone", "location", "password"] as const;

function validateDraft(draft: TenantDraft, isEdit: boolean): Record<string, string> {
  const errors: Record<string, string> = {};
  if (draft.name.trim().length < 2) errors.name = "Enter the business name (2+ characters).";
  if (!isValidEmail(draft.email)) errors.email = "Enter a valid email address.";
  if (!isValidPhone(draft.phone)) errors.phone = "Enter a valid phone number.";
  if (draft.location.trim().length < 2) errors.location = "Enter the business location.";
  if (!isEdit) {
    if ((draft.password || "").length < 8) errors.password = "Set a login password (8+ characters).";
  }
  return errors;
}

function fieldClass(hasError: boolean): string {
  return cn(
    "focus-ring h-11 w-full rounded-lg border bg-surface px-3 text-sm text-foreground placeholder:text-muted",
    hasError ? "border-rose-500/60" : "border-line",
  );
}

const ALLOWED_INDUSTRIES = new Set<IndustryKey>([
  "mobile",
  "electronics",
  "cosmetics-shop",
  "pharmacy",
  "paint-shop",
  "hardware-shop",
]);

export function TenantOnboardingModal() {
  const router = useRouter();
  const { onboarding, closeOnboarding } = useOverlays();
  const { insertTenant, updateTenant } = useTenants();
  const { pushToast } = useToast();

  const open = onboarding.open;
  const editing = onboarding.tenant;

  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<TenantDraft>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deploying, setDeploying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [deployed, setDeployed] = useState<Tenant | null>(null);
  const [issuedCredentials, setIssuedCredentials] = useState<{ email: string; password: string; demo?: boolean; trialEndsAt?: string | null } | null>(null);
  const [deployError, setDeployError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const featureTouched = useRef(false);

  const nameRef = useRef<HTMLInputElement>(null);
  const successRef = useRef<HTMLButtonElement>(null);
  const finalizedRef = useRef(false);

  const patch = (next: Partial<TenantDraft>) => {
    setDraft((current) => ({ ...current, ...next }));
  };

  const chooseIndustry = (industry: IndustryKey) => {
    setDraft((current) => ({ ...current, industry }));
    if (!featureTouched.current) {
      setSelectedFeatures(new Set(recommendedFeatures(industry)));
    }
  };

  const toggleFeature = (key: string) => {
    featureTouched.current = true;
    setSelectedFeatures((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const applyRecommendedFeatures = () => {
    featureTouched.current = true;
    setSelectedFeatures(new Set(recommendedFeatures(draft.industry)));
  };

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setErrors({});
    setDeploying(false);
    setProgress(0);
    setDeployed(null);
    setIssuedCredentials(null);
    setDeployError("");
    finalizedRef.current = false;
    featureTouched.current = false;
    setDraft(
      editing
        ? {
            name: editing.name,
            email: editing.email,
            phone: editing.phone,
            location: editing.location,
            industry: editing.industry,
            accountType: editing.accountType ?? "real",
            password: "",
            slug: editing.slug,
            owner: editing.owner,
            plan: editing.plan,
          }
        : EMPTY_DRAFT,
    );
    setSelectedFeatures(
      new Set(
        editing
          ? editing.features ?? recommendedFeatures(editing.industry)
          : recommendedFeatures(EMPTY_DRAFT.industry),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  useEffect(() => {
    if (!open || deploying || deployed || step !== 0) return;
    const id = window.requestAnimationFrame(() => nameRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open, step, deploying, deployed]);

  useEffect(() => {
    if (!deploying) return;
    setProgress(8);
    const interval = window.setInterval(() => setProgress((current) => (current < 90 ? current + 4 : current)), 120);
    return () => window.clearInterval(interval);
  }, [deploying]);

  useEffect(() => {
    if (!deploying || finalizedRef.current) return;
    finalizedRef.current = true;
    (async () => {
      try {
        const res = await fetch("/api/businesses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: draft.name,
            industry: draft.industry,
            email: draft.email,
            phone: draft.phone,
            location: draft.location,
            password: draft.password,
            accountType: draft.accountType,
            features: Array.from(selectedFeatures),
          }),
        });
        const data = (await res.json().catch(() => ({}))) as { message?: string; business?: { id: string; uid?: string | null; businessName: string; slug?: string | null; industryType: string; subscriptionTier: string; status: string; accountType?: string; trialEndsAt?: string | null; ownerName?: string | null; email?: string | null; phone?: string | null; location?: string | null; createdAt: string }; credentials?: { email: string; password?: string; temporaryPassword?: string } };
        if (!res.ok || !data.business) throw new Error(data.message || "Failed to create business.");

        const industryRev: Record<string, IndustryKey> = { MOBILE_ACCESSORIES: "mobile", PHARMACY: "pharmacy", GROCERY: "grocery", ELECTRONICS: "electronics", HARDWARE_SHOP: "hardware-shop", PAINT_SHOP: "paint-shop", COSMETICS_SHOP: "cosmetics-shop" };
        const planRev: Record<string, PlanKey> = { STARTER: "starter", PRO: "pro", ENTERPRISE: "enterprise" };
        const statusRev: Record<string, Tenant["status"]> = { ACTIVE: "active", TRIAL: "trial", DEACTIVE: "deactive" };
        const accountRev: Record<string, AccountType> = { REAL: "real", DEMO: "demo" };
        const b = data.business;
        const acct = accountRev[String(b.accountType || "")] || draft.accountType;
        const tenant: Tenant = {
          id: b.id,
          uid: b.uid || "BUS-NEW",
          name: b.businessName,
          slug: b.slug || slugify(draft.name),
          industry: industryRev[b.industryType] || draft.industry,
          plan: planRev[b.subscriptionTier] || "starter",
          accountType: acct,
          trialEndsAt: b.trialEndsAt ?? null,
          status: statusRev[b.status] || (acct === "demo" ? "trial" : "active"),
          mrr: 0,
          terminals: 1,
          staff: 1,
          owner: b.ownerName || draft.name,
          email: b.email || draft.email,
          phone: b.phone || draft.phone,
          location: b.location || draft.location,
          createdAt: new Date(b.createdAt).toLocaleDateString("en-PK", { month: "short", day: "2-digit", year: "numeric" }),
          lastSync: "just now",
          sync: "synced",
          latencyMs: 0,
          uptime: 0,
          mrrDelta: 0,
        };
        insertTenant(tenant);
        setProgress(100);
        setDeployed(tenant);
        setIssuedCredentials({
          email: data.credentials?.email || draft.email,
          password: data.credentials?.password || data.credentials?.temporaryPassword || draft.password,
          demo: acct === "demo",
          trialEndsAt: b.trialEndsAt ?? null,
        });
        pushToast({ tone: "success", title: `${tenant.name} created`, description: acct === "demo" ? "Trial Demo (7 days) ready. Data stays if converted to Real." : "Business account ready." });
      } catch (e) {
        setDeployError(e instanceof Error ? e.message : "Failed to create business.");
        setProgress(0);
      } finally {
        setDeploying(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deploying]);

  useEffect(() => {
    if (!deployed) return;
    const id = window.requestAnimationFrame(() => successRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [deployed]);

  const focusFirstError = (nextErrors: Record<string, string>) => {
    const first = FIELD_ORDER.find((field) => nextErrors[field]);
    if (first) document.getElementById(`onboard-${first}`)?.focus();
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const planKey = (draft.plan ?? editing.plan) as PlanKey;
    try {
      const payload = {
        name: draft.name.trim(),
        slug: (draft.slug || editing.slug || "").trim(),
        owner: (draft.owner || editing.owner || draft.name).trim(),
        email: draft.email.trim(),
        phone: draft.phone.trim(),
        location: draft.location.trim(),
        industry: draft.industry,
        plan: planKey,
        features: Array.from(selectedFeatures),
      };
      // Persist to DB when possible; fall back to local update for demo entries.
      const res = await fetch(`/api/businesses/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { mapped?: { status?: Tenant["status"]; industry?: Tenant["industry"]; plan?: Tenant["plan"] } };
        updateTenant(editing.id, {
          ...payload,
          mrr: PLAN_BY_KEY[planKey]?.price ?? editing.mrr,
          status: data.mapped?.status ?? editing.status,
          industry: data.mapped?.industry ?? draft.industry,
          plan: data.mapped?.plan ?? planKey,
        });
      } else {
        updateTenant(editing.id, { ...payload, mrr: PLAN_BY_KEY[planKey]?.price ?? editing.mrr });
      }
      pushToast({ tone: "success", title: `${draft.name.trim()} updated`, description: "Business details saved." });
      closeOnboarding();
    } catch {
      updateTenant(editing.id, {
        name: draft.name.trim(), slug: (draft.slug || editing.slug || "").trim(), owner: (draft.owner || editing.owner || draft.name).trim(),
        email: draft.email.trim(), phone: draft.phone.trim(), location: draft.location.trim(),
        industry: draft.industry, plan: planKey, mrr: PLAN_BY_KEY[planKey]?.price ?? editing.mrr,
      });
      pushToast({ tone: "success", title: `${draft.name.trim()} updated`, description: "Saved locally." });
      closeOnboarding();
    } finally {
      setSaving(false);
    }
  };

  const primaryAction = () => {
    if (deploying || deployed || saving) return;
    if (step < STEPS.length - 1) {
      if (step === 0) {
        const nextErrors = validateDraft(draft, Boolean(editing));
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
          focusFirstError(nextErrors);
          return;
        }
      }
      setErrors({});
      setStep((current) => current + 1);
      return;
    }
    // final step (category) -> save edit or create
    const nextErrors = validateDraft(draft, Boolean(editing));
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setStep(0);
      window.requestAnimationFrame(() => focusFirstError(nextErrors));
      return;
    }
    if (editing) void saveEdit();
    else setDeploying(true);
  };

  const requestClose = () => {
    if (deploying || saving) return;
    closeOnboarding();
  };

  const industry = INDUSTRY_BY_KEY[draft.industry];
  const selectableIndustries = INDUSTRIES.filter((item) => ALLOWED_INDUSTRIES.has(item.key as IndustryKey) || item.key === draft.industry);
  const phase =
    progress < 30
      ? "Validating business details"
      : progress < 60
        ? "Setting up account & login credentials"
        : progress < 90
          ? `Applying ${industry.shortLabel} category`
          : "Business ready";

  return (
    <DialogShell
      open={open}
      onClose={requestClose}
      labelledBy="onboarding-title"
      closeOnEscape={!deploying}
      initialFocusRef={nameRef}
      widthClass="max-w-3xl"
      panelClassName="flex max-h-[90vh] flex-col overflow-hidden"
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">
              {editing ? "Edit business" : "Create business"} {"//"}{" "}
              <span className="font-mono">{editing?.uid ?? "BUS-NEW"}</span>
            </p>
            <h2 id="onboarding-title" className="mt-0.5 text-xl font-semibold tracking-tight text-foreground">
              {editing ? `Edit ${editing.name}` : "Create a new business"}
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={requestClose}
          disabled={deploying}
          className="focus-ring -m-1 rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Close"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <ol className="flex items-center gap-2 border-b border-line bg-surface-2 px-5 py-3.5">
        {STEPS.map((item, index) => {
          const complete = index < step || (step === 1 && Boolean(deployed));
          const active = index === step;
          return (
            <li key={item.label} className="flex min-w-0 flex-1 items-center gap-2">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  complete
                    ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : active
                      ? "border-accent-line bg-accent-soft text-accent"
                      : "border-line bg-surface text-muted",
                )}
                aria-hidden
              >
                {complete ? <Check className="h-3.5 w-3.5" /> : item.short}
              </span>
              <span
                className={cn("hidden truncate text-sm font-medium sm:block", active ? "text-foreground" : "text-muted")}
                aria-current={active ? "step" : undefined}
              >
                {item.label}
              </span>
              {index < STEPS.length - 1 ? (
                <span className={cn("ml-auto hidden h-px flex-1 sm:block", complete ? "bg-emerald-500/40" : "bg-line")} aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {deployError && !deploying ? (
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
          <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-left">
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">Could not create business</p>
            <p className="mt-1 text-sm text-rose-700/90 dark:text-rose-300/90">{deployError}</p>
          </div>
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => { finalizedRef.current = false; setDeployError(""); setStep(1); }} className="focus-ring rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-foreground">Back</button>
            <button type="button" onClick={() => { finalizedRef.current = false; setDeployError(""); setDeploying(true); }} className="focus-ring rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg">Try again</button>
          </div>
        </div>
      ) : deployed ? (
        <div className="flex flex-1 flex-col items-center px-6 py-8 text-center overflow-y-auto">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          </span>
          <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Business created</h3>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">
            {deployed.name} is ready. Share the login credentials securely with the business owner.
          </p>
          <dl className="mt-5 grid w-full max-w-md grid-cols-2 gap-2 text-left">
            {[
              ["Business ID", deployed.uid],
              ["Category", INDUSTRY_BY_KEY[deployed.industry]?.label ?? deployed.industry],
              ["Account type", deployed.accountType === "demo" ? "Trial Demo (7 days)" : "Real"],
              ["Status", deployed.status === "trial" ? "Trial (active for 7 days)" : deployed.status === "deactive" ? "Deactive (Locked)" : "Active"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-line bg-surface-2 p-3">
                <dt className="text-xs font-medium uppercase tracking-[0.04em] text-muted">{label}</dt>
                <dd className="mt-0.5 truncate font-mono text-sm font-medium text-foreground">{value}</dd>
              </div>
            ))}
          </dl>
          {issuedCredentials?.demo && issuedCredentials.trialEndsAt ? (
            <div className="mt-3 w-full max-w-md rounded-lg border border-sky-500/25 bg-sky-500/10 p-3 text-left text-sm text-sky-800 dark:text-sky-200">
              Demo access ends on <b>{new Date(issuedCredentials.trialEndsAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}</b>. After 7 days the account auto-locks (Deactive) — <b>data is preserved</b>. You can convert this demo to Real from the admin panel anytime.
            </div>
          ) : null}
          {issuedCredentials ? (
            <div className="mt-4 w-full max-w-md rounded-xl border border-accent-line bg-accent-soft p-4 text-left">
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground"><KeyRound className="h-4 w-4 text-accent" aria-hidden /> Login credentials (for panel access)</p>
              <p className="mt-1 text-xs text-muted">Share securely. Super Admin can reset the password later (plaintext is never stored).</p>
              <div className="mt-3 space-y-2 rounded-lg border border-line bg-surface p-3 font-mono text-sm">
                <div className="flex items-center justify-between gap-2"><span className="text-muted">Email</span><span className="truncate text-foreground">{issuedCredentials.email}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="text-muted">Password</span><span className="text-foreground">{issuedCredentials.password}</span></div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  const text = `Email: ${issuedCredentials.email}\nPassword: ${issuedCredentials.password}`;
                  try { await navigator.clipboard.writeText(text); pushToast({ title: "Credentials copied", tone: "success" }); } catch { pushToast({ title: "Copy failed", tone: "error" }); }
                }}
                className="focus-ring mt-3 inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong"
              >
                <Copy className="h-4 w-4" aria-hidden /> Copy credentials
              </button>
            </div>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              ref={successRef}
              type="button"
              onClick={() => {
                closeOnboarding();
                router.push("/tenants");
              }}
              className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg"
            >
              View businesses
              <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={closeOnboarding}
              className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-semibold text-foreground"
            >
              Close
            </button>
          </div>
        </div>
      ) : deploying ? (
        <div className="flex flex-1 flex-col justify-center px-6 py-12">
          <div className="mx-auto w-full max-w-md text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-accent-line bg-accent-soft text-accent">
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
            </span>
            <h3 className="mt-4 text-xl font-semibold text-foreground">Creating {draft.name || "business"} account</h3>
            <p className="mt-1 text-sm text-muted" aria-live="polite">{phase}</p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${progress}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-xs text-muted">
              <span>{INDUSTRY_BY_KEY[draft.industry].engine}</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-5 space-y-2 text-left">
              {[
                "Business details saved",
                "Login credentials configured",
                `${INDUSTRY_BY_KEY[draft.industry].shortLabel} category applied`,
                draft.accountType === "demo" ? "7-day trial demo activated" : "Account ready",
              ].map((item, index) => {
                const threshold = (index + 1) * 24;
                const done = progress >= threshold;
                return (
                  <div
                    key={item}
                    className={cn(
                      "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                      done ? "border-emerald-500/25 bg-emerald-500/[0.06] text-foreground" : "border-line bg-surface text-muted",
                    )}
                  >
                    {done ? <Check className="h-4 w-4 text-emerald-500" aria-hidden /> : <Loader2 className="h-4 w-4 animate-spin opacity-60" aria-hidden />}
                    {item}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            primaryAction();
          }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            {step === 0 ? (
              <div className="animate-fade-in space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Business details</h3>
                  <p className="mt-0.5 text-sm text-muted">Enter details, set login credentials, and choose account type.</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="onboard-name" className="mb-1.5 block text-sm font-medium text-foreground">
                      Business name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      ref={nameRef}
                      id="onboard-name"
                      value={draft.name}
                      onChange={(event) => patch({ name: event.target.value })}
                      autoComplete="organization"
                      placeholder="e.g. Aura Mobile Hub"
                      aria-invalid={Boolean(errors.name)}
                      className={fieldClass(Boolean(errors.name))}
                    />
                    {errors.name ? <p role="alert" className="mt-1 text-sm text-rose-700 dark:text-rose-400">{errors.name}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="onboard-email" className="mb-1.5 block text-sm font-medium text-foreground">
                      Email (login) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="onboard-email"
                      type="email"
                      inputMode="email"
                      value={draft.email}
                      onChange={(event) => patch({ email: event.target.value })}
                      autoComplete="off"
                      placeholder="business@email.com"
                      aria-invalid={Boolean(errors.email)}
                      className={fieldClass(Boolean(errors.email))}
                    />
                    {errors.email ? <p role="alert" className="mt-1 text-sm text-rose-700 dark:text-rose-400">{errors.email}</p> : null}
                  </div>
                  <div>
                    <label htmlFor="onboard-phone" className="mb-1.5 block text-sm font-medium text-foreground">Phone number <span className="text-rose-500">*</span></label>
                    <input
                      id="onboard-phone"
                      type="tel"
                      inputMode="tel"
                      value={draft.phone}
                      onChange={(event) => patch({ phone: event.target.value })}
                      autoComplete="tel"
                      placeholder="+92 300 1234567"
                      aria-invalid={Boolean(errors.phone)}
                      className={fieldClass(Boolean(errors.phone))}
                    />
                    {errors.phone ? <p role="alert" className="mt-1 text-sm text-rose-700 dark:text-rose-400">{errors.phone}</p> : null}
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="onboard-location" className="mb-1.5 block text-sm font-medium text-foreground">
                      Location <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="onboard-location"
                      value={draft.location}
                      onChange={(event) => patch({ location: event.target.value })}
                      placeholder="City, Country"
                      aria-invalid={Boolean(errors.location)}
                      className={fieldClass(Boolean(errors.location))}
                    />
                    {errors.location ? <p role="alert" className="mt-1 text-sm text-rose-700 dark:text-rose-400">{errors.location}</p> : null}
                  </div>
                  {!editing ? (
                    <div>
                      <label htmlFor="onboard-password" className="mb-1.5 block text-sm font-medium text-foreground">
                        Password (login) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        id="onboard-password"
                        type="password"
                        value={draft.password}
                        onChange={(event) => patch({ password: event.target.value })}
                        autoComplete="new-password"
                        placeholder="Set panel password (8+ chars)"
                        aria-invalid={Boolean(errors.password)}
                        className={fieldClass(Boolean(errors.password))}
                      />
                      {errors.password ? <p role="alert" className="mt-1 text-sm text-rose-700 dark:text-rose-400">{errors.password}</p> : null}
                    </div>
                  ) : null}
                  <div className={editing ? "sm:col-span-2" : ""}>
                    <label htmlFor="onboard-account-type" className="mb-1.5 block text-sm font-medium text-foreground">
                      Account type <span className="text-rose-500">*</span>
                    </label>
                    <select
                      id="onboard-account-type"
                      value={draft.accountType}
                      onChange={(event) => patch({ accountType: event.target.value as AccountType })}
                      disabled={Boolean(editing)}
                      className="focus-ring h-11 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground disabled:opacity-70"
                    >
                      <option value="real">Real</option>
                      <option value="demo">Trial Demo (7 days free access)</option>
                    </select>
                    {draft.accountType === "demo" ? (
                      <p className="mt-1.5 text-xs text-muted">Full access for <b className="text-foreground">7 days</b>. After 7 days the account auto-locks (Deactive) — <b className="text-foreground">data is preserved</b>. You can convert this demo to Real from the admin panel and keep all stock/data.</p>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted">Real account with normal access.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            {step === 1 ? (
              <div className="animate-fade-in space-y-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Select category</h3>
                  <p className="mt-0.5 text-sm text-muted">
                    Choose the business category. Each category has its own customized panel/workflow.
                  </p>
                </div>
                <div role="radiogroup" aria-label="Business category panel" className="grid gap-2.5 sm:grid-cols-2">
                  {selectableIndustries.map((item) => {
                    const selected = draft.industry === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => chooseIndustry(item.key as IndustryKey)}
                        className={cn(
                          "focus-ring relative rounded-xl border p-4 text-left transition-colors",
                          selected ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2",
                        )}
                      >
                        <span className="flex items-start justify-between gap-2">
                          <IndustryGlyph industry={item.key} size="md" />
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full border",
                              selected ? "border-accent bg-accent text-accent-fg" : "border-line bg-surface text-transparent",
                            )}
                            aria-hidden
                          >
                            <Check className="h-3 w-3" />
                          </span>
                        </span>
                        <span className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          <span className="text-sm font-semibold text-foreground">{item.label}</span>
                          {selected ? <span className="rounded border border-accent-line bg-surface px-2 py-0.5 text-xs font-medium text-accent">Selected</span> : null}
                        </span>
                        <span className="mt-1 block text-sm font-medium text-accent">{item.engine} · separate panel</span>
                        <span className="mt-1.5 block text-sm leading-relaxed text-muted">{item.description}</span>
                        <span className="mt-2.5 flex flex-wrap gap-1">
                          {item.bullets.slice(0, 2).map((bullet) => (
                            <span key={bullet} className="rounded-md border border-line bg-surface px-2 py-0.5 text-xs text-muted">{bullet}</span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {step === 2 ? (
              <div className="animate-fade-in space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">Feature access</h3>
                    <p className="mt-0.5 text-sm text-muted">
                      Tick the features this business can use. Unticked features are removed from their panel. Bulk
                      quantity stock, POS and invoices are always included.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={applyRecommendedFeatures}
                    className="focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-foreground hover:border-line-strong"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
                    Apply recommended
                  </button>
                </div>

                <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.07] px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300">
                  <b>Bulk quantity stock is always on</b> for every panel. Products can be added as bulk stock or (when
                  the IMEI/Serial checkbox is ticked) as individual serial/IMEI units.
                </div>

                <div className="space-y-4">
                  {FEATURE_GROUPS.map((group) => {
                    const features = FEATURES.filter((feature) => feature.group === group);
                    if (features.length === 0) return null;
                    return (
                      <div key={group}>
                        <p className="mb-2 text-sm font-semibold text-foreground">{group}</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {features.map((feature) => {
                            const checked = selectedFeatures.has(feature.key);
                            const recommended = recommendedFeatures(draft.industry).includes(feature.key);
                            return (
                              <label
                                key={feature.key}
                                className={cn(
                                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                                  checked
                                    ? "border-accent-line bg-accent-soft/40"
                                    : "border-line bg-surface-2/40 hover:border-line-strong",
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleFeature(feature.key)}
                                  className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                                  aria-label={feature.label}
                                />
                                <span className="min-w-0">
                                  <span className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-sm font-semibold text-foreground">{feature.label}</span>
                                    {recommended ? (
                                      <span className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                                        <Info className="h-2.5 w-2.5" aria-hidden />
                                        Recommended
                                      </span>
                                    ) : null}
                                  </span>
                                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                                    {feature.description}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted">
                  {selectedFeatures.size} optional feature{selectedFeatures.size === 1 ? "" : "s"} selected. You can
                  change this later from the admin <b className="text-foreground">Access</b> page.
                </p>
              </div>
            ) : null}

          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-2 px-5 py-3.5">
            <div className="ml-auto flex items-center gap-2">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((current) => current - 1)}
                  className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-line-strong"
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Back
                </button>
              ) : null}
              <button
                type="submit"
                disabled={saving}
                className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-fg transition-opacity hover:bg-accent-hover disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {step === STEPS.length - 1 ? (
                  <>
                    {!saving ? (editing ? <Check className="h-4 w-4" aria-hidden /> : <Rocket className="h-4 w-4" aria-hidden />) : null}
                    {editing ? (saving ? "Saving…" : "Save changes") : "Create business"}
                  </>
                ) : (
                  <>
                    Continue
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </DialogShell>
  );
}
