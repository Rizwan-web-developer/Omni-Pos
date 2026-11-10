"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Boxes,
  Building2,
  Clock,
  Copy,
  ExternalLink,
  KeyRound,
  Mail,
  MapPin,
  Pencil,
  Phone,
  RotateCcw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DialogShell } from "@/components/ui/DialogShell";
import { IndustryGlyph, PlanBadge, StatusBadge } from "@/components/ui/Badges";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useTenants } from "@/components/providers/TenantProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { INDUSTRY_BY_KEY, PLAN_BY_KEY } from "@/lib/data";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-[0.04em] text-muted">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-foreground" title={value}>
        {value}
      </dd>
    </div>
  );
}

export function TenantDrawer() {
  const { drawerTenantId, closeTenant, openOnboarding } = useOverlays();
  const { tenants, setTenantStatus, updateTenant, deleteTenant } = useTenants();
  const { pushToast } = useToast();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [access, setAccess] = useState<{ dbId?: string; accountType?: string; trialEndsAt?: string | null; dbStatus?: string; users: Array<{ id: string; name: string; email: string; role: string; isActive: boolean }> } | null>(null);
  const [accessLoading, setAccessLoading] = useState(false);
  const [resetInfo, setResetInfo] = useState<{ email: string; temporaryPassword: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [converting, setConverting] = useState(false);
  const [confirmConvert, setConfirmConvert] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const tenant = tenants.find((item) => item.id === drawerTenantId) ?? null;

  useEffect(() => {
    if (!tenant) return;
    let cancelled = false;
    setAccess(null);
    setResetInfo(null);
    setAccessLoading(true);
    fetch("/api/businesses", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.businesses) ? data.businesses : [];
        const found = list.find((b: { id: string; uid?: string | null; slug?: string | null; users?: unknown[] }) => b.uid === tenant.uid || b.id === tenant.id || b.slug === tenant.slug);
        if (found) setAccess({ dbId: found.id, accountType: found.accountType, trialEndsAt: found.trialEndsAt, dbStatus: found.status, users: (found.users || []) as Array<{ id: string; name: string; email: string; role: string; isActive: boolean }> });
        else setAccess({ users: [] });
      })
      .catch(() => { if (!cancelled) setAccess({ users: [] }); })
      .finally(() => { if (!cancelled) setAccessLoading(false); });
    return () => { cancelled = true; };
  }, [tenant?.id, tenant?.uid, tenant?.slug]);

  if (!tenant) return null;

  const industry = INDUSTRY_BY_KEY[tenant.industry];
  const plan = PLAN_BY_KEY[tenant.plan];

  const copyUid = async () => {
    try {
      await navigator.clipboard.writeText(tenant.uid);
      pushToast({ title: "Business ID copied", description: tenant.uid, tone: "success" });
    } catch {
      pushToast({
        title: "Clipboard unavailable",
        description: "Select the ID manually to copy it.",
        tone: "error",
      });
    }
  };

  // (status changes handled via explicit manual status buttons)

  return (
    <DialogShell
      open
      onClose={closeTenant}
      labelledBy="tenant-drawer-title"
      initialFocusRef={closeRef}
      side="right"
      panelClassName="flex flex-col"
    >
      <div className="border-b border-line px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <IndustryGlyph industry={tenant.industry} size="lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={tenant.status} />
                <PlanBadge plan={tenant.plan} />
              </div>
              <h2
                id="tenant-drawer-title"
                className="mt-2 truncate text-xl font-semibold tracking-tight text-foreground"
              >
                {tenant.name}
              </h2>
              <p className="mt-0.5 font-mono text-sm text-muted">
                {tenant.slug}.omnipos.app
              </p>
            </div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={closeTenant}
            className="focus-ring -m-1 shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            aria-label="Close business details"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
          <span className="font-mono text-sm text-muted">{tenant.uid}</span>
          <button
            type="button"
            onClick={copyUid}
            className="focus-ring rounded p-1 text-muted transition-colors hover:text-foreground"
            aria-label={`Copy business ID ${tenant.uid}`}
          >
            <Copy className="h-3 w-3" aria-hidden />
          </button>
          <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-3 w-3" aria-hidden />
            {tenant.sync === "offline" ? "Sync offline" : `Synced ${tenant.lastSync}`}
          </span>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5">
        <section aria-labelledby="drawer-identity">
          <h3
            id="drawer-identity"
            className="mb-3 text-sm font-semibold text-foreground"
          >
            Business details
          </h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4">
            <DetailRow label="Contact / owner" value={tenant.owner} />
            <DetailRow label="Business location" value={tenant.location} />
            <DetailRow label="Created" value={tenant.createdAt} />
            <DetailRow label="Category / panel" value={industry.label} />
          </dl>
          <div className="mt-4 space-y-2">
            <a
              href={`mailto:${tenant.email}`}
              className="focus-ring flex items-center gap-2 rounded-md px-1 py-1 text-sm text-muted transition-colors hover:text-foreground"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden />
              {tenant.email}
            </a>
            <a
              href={`tel:${tenant.phone.replace(/\s+/g, "")}`}
              className="focus-ring flex items-center gap-2 rounded-md px-1 py-1 text-sm text-muted transition-colors hover:text-foreground"
            >
              <Phone className="h-3.5 w-3.5" aria-hidden />
              {tenant.phone}
            </a>
            <span className="flex items-center gap-2 px-1 py-1 text-sm text-muted">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {tenant.location}
            </span>
          </div>
        </section>

        <section aria-labelledby="drawer-access">
          <h3 id="drawer-access" className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <KeyRound className="h-4 w-4 text-accent" aria-hidden /> Admin access &amp; credentials
          </h3>
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <p className="text-xs text-muted">Super Admin can view access and reset passwords (plaintext never stored; reset shows a temporary password once).</p>
            {accessLoading ? <p className="mt-3 text-sm text-muted">Loading access…</p> : access && access.users.length > 0 ? (
              <div className="mt-3 space-y-2">
                {access.users.map((u) => (
                  <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{u.name} <span className="text-xs font-normal text-muted">({u.role})</span></p>
                      <p className="truncate font-mono text-xs text-muted">{u.email}</p>
                    </div>
                    {access.dbId ? (
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/businesses/${access.dbId}/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: u.id }) });
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.message || "Reset failed");
                            setResetInfo(data.credentials);
                            pushToast({ title: "Password reset", description: "Temporary password generated (shown once).", tone: "success" });
                          } catch (e) {
                            pushToast({ title: "Reset failed", description: e instanceof Error ? e.message : "Error", tone: "error" });
                          }
                        }}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-foreground hover:border-accent/40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset password
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No DB access record found for this business (local/demo entry). Create the business via admin to manage credentials.</p>
            )}
            {resetInfo ? (
              <div className="mt-3 rounded-lg border border-accent-line bg-accent-soft p-3">
                <p className="text-xs font-semibold text-foreground">New temporary password (shown once)</p>
                <p className="mt-1 font-mono text-sm text-foreground">{resetInfo.email}</p>
                <p className="font-mono text-sm font-semibold text-foreground">{resetInfo.temporaryPassword}</p>
                <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(`Email: ${resetInfo.email}\nTemporary password: ${resetInfo.temporaryPassword}`); pushToast({ title: "Copied", tone: "success" }); } catch { pushToast({ title: "Copy failed", tone: "error" }); } }} className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2 py-1.5 text-xs font-medium text-foreground"><Copy className="h-3.5 w-3.5" /> Copy</button>
              </div>
            ) : null}
          </div>
        </section>

        <section aria-labelledby="drawer-commercial">
          <h3 id="drawer-commercial" className="mb-3 text-sm font-semibold text-foreground">
            Commercial
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="text-xs text-muted">Monthly recurring revenue</p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {formatCurrency(tenant.mrr)}
              </p>
              <p
                className={cn(
                  "mt-0.5 text-xs font-medium",
                  tenant.mrrDelta >= 0
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-rose-700 dark:text-rose-400",
                )}
              >
                {tenant.mrrDelta >= 0 ? "+" : ""}
                {tenant.mrrDelta}% MoM
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="text-xs text-muted">Subscription tier</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{plan.name}</p>
              <p className="mt-0.5 text-xs text-muted">
                ${plan.price}/mo · {plan.outlets}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Boxes className="h-3 w-3" aria-hidden />
                Terminals
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {tenant.terminals}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-xs text-muted">
                <Users className="h-3 w-3" aria-hidden />
                Staff seats
              </p>
              <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
                {tenant.staff}
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="drawer-engine">
          <h3 id="drawer-engine" className="mb-3 text-sm font-semibold text-foreground">
            Business panel
          </h3>
          <div className="rounded-xl border border-line bg-surface-2 p-4">
            <div className="flex items-center gap-2">
              <IndustryGlyph industry={tenant.industry} size="sm" />
              <div>
                <p className="text-sm font-semibold text-foreground">{industry.engine}</p>
                <p className="text-xs text-muted">{industry.protocol}</p>
              </div>
            </div>
            <ul className="mt-3 space-y-1.5">
              {industry.bullets.map((bullet) => (
                <li key={bullet} className="flex items-start gap-2 text-sm text-muted">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="drawer-health">
          <h3 id="drawer-health" className="mb-3 text-sm font-semibold text-foreground">
            Runtime health
          </h3>
          <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted">
                <Activity className="h-3.5 w-3.5" aria-hidden />
                Uptime
              </span>
              <span className="font-mono font-semibold text-foreground">
                {formatPercent(tenant.uptime, 3)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-surface">
              <span
                className="block h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.max(60, tenant.uptime)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted">
                <Clock className="h-3.5 w-3.5" aria-hidden />
                Last sync
              </span>
              <span className="font-mono text-foreground">{tenant.lastSync}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1.5 text-muted">
                <Building2 className="h-3.5 w-3.5" aria-hidden />
                Shard
              </span>
              <span className="font-mono text-foreground">
                {tenant.latencyMs > 0 ? `${tenant.latencyMs}ms RTT` : "No heartbeat"}
              </span>
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-line bg-surface px-5 py-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => openOnboarding(tenant)}
            className="focus-ring col-span-2 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-accent/40"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            Edit business details
          </button>
        </div>
        <div className="mt-2">
          <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.04em] text-muted">Status (manual)</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              ["active", "Active", "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"],
              ["trial", "Trial", "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"],
              ["deactive", "Deactive (Locked)", "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"],
            ] as const).map(([value, label, activeCls]) => {
              const selected = tenant.status === value;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={selected}
                  onClick={async () => {
                    if (selected) return;
                    setTenantStatus(tenant.id, value);
                    const targetId = access?.dbId || tenant.id;
                    try {
                      await fetch(`/api/businesses/${targetId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: value }),
                      });
                    } catch {}
                    pushToast({
                      tone: value === "deactive" ? "warning" : "success",
                      title: `${tenant.name}: ${label}`,
                      description: value === "deactive" ? "Business is locked." : "Status updated.",
                    });
                  }}
                  className={cn(
                    "focus-ring rounded-lg border px-2 py-2 text-xs font-semibold transition-colors disabled:cursor-default",
                    selected ? activeCls : "border-line bg-surface-2 text-muted hover:text-foreground",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {String(access?.accountType || "").toUpperCase() === "DEMO" ? (
            <div className="mt-2 rounded-lg border border-sky-500/25 bg-sky-500/[0.06] p-3">
              <p className="text-xs font-semibold text-foreground">Trial Demo account</p>
              <p className="mt-0.5 text-xs text-muted">
                {access?.trialEndsAt ? <>Auto-locks after 7 days (ends {new Date(access.trialEndsAt).toLocaleDateString("en-PK")}). </> : null}
                Data is preserved. Convert to Real to keep all stock/data and unlock full access.
              </p>
              <button
                type="button"
                disabled={converting || !access?.dbId}
                onClick={() => setConfirmConvert(true)}
                className="focus-ring mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-500/15 disabled:opacity-60 dark:text-emerald-300"
              >
                {converting ? "Converting…" : "Convert Demo to Real (keep data)"}
              </button>
            </div>
          ) : null}
        </div>

        <Link
          href={`/store/${access?.dbId || tenant.id}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={closeTenant}
          className="focus-ring mt-2 flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2.5 text-sm font-semibold text-accent-fg transition-opacity hover:bg-accent-hover"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          Open store panel (separate window)
        </Link>

        <button
          type="button"
          disabled={deleting}
          onClick={() => setConfirmDelete(true)}
          className="focus-ring mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-500/15 disabled:opacity-60 dark:text-rose-300"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {deleting ? "Deleting…" : "Delete business"}
        </button>
      </div>

      <ConfirmDialog
        open={confirmConvert}
        onClose={() => setConfirmConvert(false)}
        loading={converting}
        tone="warning"
        title="Convert Demo to Real?"
        description="This will convert the Trial Demo account to a Real account. All stock, sales, and data will be kept and the account will be activated."
        confirmLabel="Convert to Real"
        onConfirm={async () => {
          if (!access?.dbId) return;
          setConverting(true);
          try {
            const res = await fetch(`/api/businesses/${access.dbId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ convertToReal: true }) });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error((data as { message?: string }).message || "Convert failed");
            updateTenant(tenant.id, { accountType: "real", status: "active", trialEndsAt: null });
            setAccess((a) => (a ? { ...a, accountType: "REAL", dbStatus: "ACTIVE", trialEndsAt: null } : a));
            setConfirmConvert(false);
            pushToast({ tone: "success", title: "Converted to Real", description: "Demo converted. All data preserved and account is active." });
          } catch (e) {
            pushToast({ tone: "error", title: "Convert failed", description: e instanceof Error ? e.message : "Error" });
          } finally {
            setConverting(false);
          }
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        loading={deleting}
        tone="danger"
        title={`Delete "${tenant.name}"?`}
        description="This will permanently remove the business and its data (users, products, sales). This cannot be undone."
        confirmLabel="Delete business"
        onConfirm={async () => {
          setDeleting(true);
          const targetId = access?.dbId || tenant.id;
          try {
            const res = await fetch(`/api/businesses/${targetId}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok && res.status !== 404) throw new Error((data as { message?: string }).message || "Delete failed");
            deleteTenant(tenant.id);
            setConfirmDelete(false);
            closeTenant();
            pushToast({ tone: "success", title: "Business deleted", description: `${tenant.name} removed.` });
          } catch (e) {
            pushToast({ tone: "error", title: "Delete failed", description: e instanceof Error ? e.message : "Error" });
          } finally {
            setDeleting(false);
          }
        }}
      />
    </DialogShell>
  );
}
