"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Eye,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { IndustryGlyph, PlanBadge, StatusBadge } from "@/components/ui/Badges";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useTenants } from "@/components/providers/TenantProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { INDUSTRY_BY_KEY, STATUS_ORDER } from "@/lib/data";
import type { Tenant, TenantStatus } from "@/lib/types";
import { cn, formatCurrency, initials } from "@/lib/utils";

type StatusFilter = "all" | TenantStatus;
type SortKey = "recent" | "mrr" | "name";

const FILTERS: StatusFilter[] = ["all", ...STATUS_ORDER];

const FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All",
  active: "Active",
  trial: "Trial",
  deactive: "Deactive (Locked)",
};

interface TenantTableProps {
  title?: string;
  description?: string;
}

export function TenantTable({
  title = "Business directory",
  description = "Every business, its category panel and sync state.",
}: TenantTableProps) {
  const { tenants, setTenantStatus, deleteTenant, refresh } = useTenants();
  const { openOnboarding, openTenant } = useOverlays();
  const { pushToast } = useToast();

  useEffect(() => { void refresh(); }, [refresh]);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("recent");
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = tenants.filter((tenant) => status === "all" || tenant.status === status);

    if (q) {
      list = list.filter((tenant) =>
        [
          tenant.name,
          tenant.slug,
          tenant.uid,
          tenant.owner,
          tenant.email,
          tenant.location,
          INDUSTRY_BY_KEY[tenant.industry].label,
          tenant.plan,
          tenant.status,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }

    if (sort === "mrr") list = [...list].sort((a, b) => b.mrr - a.mrr);
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));

    return list;
  }, [tenants, query, status, sort]);

  const counts = useMemo(() => {
    return tenants.reduce<Record<string, number>>(
      (acc, tenant) => {
        acc[tenant.status] = (acc[tenant.status] ?? 0) + 1;
        return acc;
      },
      { all: tenants.length },
    );
  }, [tenants]);

  const toggleStatus = (tenant: Tenant) => {
    const next: TenantStatus = tenant.status === "active" ? "deactive" : "active";
    setTenantStatus(tenant.id, next);
    void fetch(`/api/businesses/${tenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => {});
    pushToast({
      tone: next === "active" ? "success" : "warning",
      title: `${tenant.name} ${next === "active" ? "activated" : "deactivated (locked)"}`,
      description:
        next === "active"
          ? "The business can access its panel."
          : "Access for this business is locked until reactivated.",
    });
  };

  const resetFilters = () => {
    setQuery("");
    setStatus("all");
    setSort("recent");
  };

  return (
    <section
      className="overflow-hidden rounded-xl border border-line bg-surface"
      aria-labelledby="tenant-directory-title"
    >
      <div className="border-b border-line px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h2
                id="tenant-directory-title"
                className="text-base font-semibold tracking-tight text-foreground"
              >
                {title}
              </h2>
              <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted">
                {filtered.length}/{tenants.length}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          </div>

          <button
            type="button"
            onClick={() => openOnboarding()}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New business
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="relative min-w-0 flex-1 xl:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
              aria-hidden
            />
            <input
              id="tenant-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search businesses, ID, owner, category…"
              aria-label="Search businesses"
              className="focus-ring h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm text-foreground placeholder:text-muted"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1 overflow-x-auto pb-0.5" aria-label="Filter by status">
            {FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setStatus(filter)}
                aria-pressed={status === filter}
                className={cn(
                  "focus-ring flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-2 text-sm font-medium transition-colors",
                  status === filter
                    ? "border-accent-line bg-accent-soft text-accent"
                    : "border-transparent text-muted hover:border-line hover:bg-surface-2 hover:text-foreground",
                )}
              >
                {FILTER_LABELS[filter]}
                <span className="font-mono text-xs text-muted">{counts[filter] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="tenant-sort" className="sr-only">
              Sort businesses
            </label>
            <div className="relative">
              <ArrowUpDown
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
                aria-hidden
              />
              <select
                id="tenant-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="focus-ring h-10 appearance-none rounded-lg border border-line bg-surface pl-8 pr-8 text-sm font-medium text-muted hover:text-foreground"
              >
                <option value="recent">Recent</option>
                <option value="mrr">Highest MRR</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] border-collapse text-left">
          <caption className="sr-only">Businesses and category panels.</caption>
          <thead>
            <tr className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
              <th scope="col" className="px-4 py-2.5 pl-5">Business</th>
              <th scope="col" className="px-3 py-2.5">Business ID</th>
              <th scope="col" className="px-3 py-2.5">Category / panel</th>
              <th scope="col" className="px-3 py-2.5 text-right">Terminals</th>
              <th scope="col" className="px-3 py-2.5 text-right">MRR</th>
              <th scope="col" className="px-3 py-2.5">Plan</th>
              <th scope="col" className="px-3 py-2.5">Status</th>
              <th scope="col" className="px-3 py-2.5">Cloud sync</th>
              <th scope="col" className="px-4 py-2.5 text-right pr-5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-16">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-surface-2 text-muted">
                      <Building2 className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">No businesses match this view</p>
                      <p className="mt-1 text-sm text-muted">Clear the filters, or create a new business.</p>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={resetFilters}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong"
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden />
                        Reset filters
                      </button>
                      <button
                        type="button"
                        onClick={() => openOnboarding()}
                        className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-fg"
                      >
                        <Plus className="h-4 w-4" aria-hidden />
                        Create business
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((tenant) => {
                const industry = INDUSTRY_BY_KEY[tenant.industry];
                const syncLabel =
                  tenant.sync === "offline"
                    ? "No heartbeat"
                    : tenant.sync === "syncing"
                      ? "Syncing…"
                      : `${tenant.latencyMs}ms · ${tenant.lastSync}`;

                return (
                  <tr
                    key={tenant.id}
                    onClick={() => openTenant(tenant.id)}
                    className="group cursor-pointer border-b border-line text-sm transition-colors last:border-b-0 hover:bg-surface-2"
                  >
                    <td className="py-3.5 pl-5 pr-4">
                      <div className="flex items-center gap-3">
                        <span
                          className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-xs font-semibold tracking-wide text-foreground"
                          aria-hidden
                        >
                          {initials(tenant.name)}
                          <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-surface bg-surface">
                            <IndustryGlyph industry={tenant.industry} size="sm" />
                          </span>
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">{tenant.name}</p>
                          <p className="mt-0.5 truncate font-mono text-xs text-muted">{tenant.slug}.omnipos.app</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 font-mono text-xs text-muted">{tenant.uid}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex items-center gap-2">
                        <IndustryGlyph industry={tenant.industry} size="sm" />
                        <span className="whitespace-nowrap text-sm text-foreground">{industry.shortLabel}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono tabular-nums text-muted">{tenant.terminals}</td>
                    <td className="px-3 py-3.5 text-right">
                      <span className="font-mono font-semibold tabular-nums text-foreground">{formatCurrency(tenant.mrr)}</span>
                      <span
                        className={cn(
                          "ml-1.5 inline-flex items-center text-xs font-medium",
                          tenant.mrrDelta >= 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-rose-700 dark:text-rose-400",
                        )}
                      >
                        {tenant.mrrDelta >= 0 ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />}
                        {Math.abs(tenant.mrrDelta)}%
                      </span>
                    </td>
                    <td className="px-3 py-3.5"><PlanBadge plan={tenant.plan} /></td>
                    <td className="px-3 py-3.5"><StatusBadge status={tenant.status} /></td>
                    <td className="px-3 py-3.5">
                      <span className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            tenant.sync === "synced"
                              ? "bg-emerald-500"
                              : tenant.sync === "syncing"
                                ? "animate-pulse bg-sky-500"
                                : "bg-rose-500",
                          )}
                          aria-hidden
                        />
                        {syncLabel}
                      </span>
                    </td>
                    <td className="py-3.5 pl-3 pr-5">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openTenant(tenant.id);
                          }}
                          className="focus-ring rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
                          aria-label={`View ${tenant.name}`}
                        >
                          <Eye className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openOnboarding(tenant);
                          }}
                          className="focus-ring rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
                          aria-label={`Edit ${tenant.name}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleStatus(tenant);
                          }}
                          className="focus-ring rounded-md p-1.5 text-muted transition-colors hover:bg-surface hover:text-foreground"
                          aria-label={`${tenant.status === "active" ? "Deactivate (lock)" : "Activate"} ${tenant.name}`}
                        >
                          <Power className="h-4 w-4" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteTarget(tenant);
                          }}
                          className="focus-ring rounded-md p-1.5 text-muted transition-colors hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
                          aria-label={`Delete ${tenant.name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        loading={deleting}
        tone="danger"
        title={deleteTarget ? `Delete "${deleteTarget.name}"?` : "Delete business?"}
        description="This will permanently remove the business and its data (users, products, sales). This cannot be undone."
        confirmLabel="Delete business"
        onConfirm={async () => {
          if (!deleteTarget) return;
          setDeleting(true);
          try {
            const res = await fetch(`/api/businesses/${deleteTarget.id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 404) {
              const data = await res.json().catch(() => ({}));
              throw new Error((data as { message?: string }).message || "Delete failed");
            }
            deleteTenant(deleteTarget.id);
            pushToast({ tone: "success", title: "Business deleted", description: `${deleteTarget.name} removed.` });
            setDeleteTarget(null);
          } catch (e) {
            pushToast({ tone: "error", title: "Delete failed", description: e instanceof Error ? e.message : "Error" });
          } finally {
            setDeleting(false);
          }
        }}
      />
    </section>
  );
}
