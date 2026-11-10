"use client";

import {
  Boxes,
  Building2,
  CloudOff,
  Download,
  Plus,
  Wifi,
} from "lucide-react";

import { TenantTable } from "@/components/TenantTable";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useTenants } from "@/components/providers/TenantProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { formatCurrency } from "@/lib/utils";

export function TenantsView() {
  const { tenants } = useTenants();
  const { openOnboarding } = useOverlays();
  const { pushToast } = useToast();

  const active = tenants.filter((tenant) => tenant.status === "active").length;
  const deactive = tenants.filter((tenant) => tenant.status === "deactive").length;
  const terminals = tenants.reduce((sum, tenant) => sum + tenant.terminals, 0);
  const mrr = tenants.reduce((sum, tenant) => sum + tenant.mrr, 0);

  const stats = [
    {
      label: "Businesses",
      value: String(tenants.length),
      hint: "across category panels",
      icon: Building2,
    },
    {
      label: "Active businesses",
      value: String(active),
      hint: `${deactive} deactive (locked)`,
      icon: Wifi,
    },
    {
      label: "POS terminals",
      value: String(terminals),
      hint: "under this admin scope",
      icon: Boxes,
    },
    {
      label: "Business MRR",
      value: formatCurrency(mrr),
      hint: "current billing cycle",
      icon: CloudOff,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2.5 text-xs font-medium text-muted">
            <span>Business directory</span>
            <span className="text-line-strong">/</span>
            <span>Global scope</span>
          </div>
          <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            Businesses
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Create businesses, assign the right category panel, and manage their status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              pushToast({
                title: "Business CSV queued",
                description: `${tenants.length} businesses · signed download ready shortly.`,
                tone: "success",
              })
            }
            className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-muted transition-colors hover:border-line-strong hover:text-foreground"
          >
            <Download className="h-4 w-4" aria-hidden />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => openOnboarding()}
            className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New business
          </button>
        </div>
      </div>

      <section
        aria-label="Business summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">{stat.label}</p>
                <div className="mt-0.5 flex items-baseline gap-2">
                  <span className="text-lg font-semibold tabular-nums text-foreground">
                    {stat.value}
                  </span>
                  <span className="truncate text-xs text-muted">{stat.hint}</span>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <TenantTable
        title="All businesses"
        description="Select a row to view details, edit a business, or deactivate/activate it."
      />
    </div>
  );
}
