"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CircleCheckBig,
  Clock3,
  ExternalLink,
  LayoutPanelTop,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  TrendingUp,
  Wifi,
  type LucideIcon,
} from "lucide-react";

import { TenantTable } from "@/components/TenantTable";
import { IndustryGlyph, PlanBadge, StatusBadge } from "@/components/ui/Badges";
import { useOverlays } from "@/components/providers/OverlayProvider";
import { useTenants } from "@/components/providers/TenantProvider";
import { GLOBAL_METRICS, INDUSTRY_BY_KEY, getRevenueSeries } from "@/lib/data";
import { cn, formatCurrency, formatPercent } from "@/lib/utils";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function SparkBars({ values, className }: { values: number[]; className?: string }) {
  return (
    <span className={cn("flex h-8 items-end gap-[3px]", className)} aria-hidden>
      {values.map((value, index) => (
        <span
          key={index}
          className="w-[3px] rounded-sm bg-accent/45 transition-colors group-hover:bg-accent"
          style={{ height: `${Math.max(14, value)}%` }}
        />
      ))}
    </span>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  badge: string;
  badgeTone: "positive" | "neutral" | "warning";
  sublabel: string;
  icon: LucideIcon;
  bars: number[];
  delta?: string;
}

function KpiCard({ label, value, badge, badgeTone, sublabel, icon: Icon, bars, delta }: KpiCardProps) {
  return (
    <div className="group rounded-xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-2 text-muted transition-colors group-hover:text-accent">
          <Icon className="h-4 w-4" strokeWidth={1.9} aria-hidden />
        </span>
        <SparkBars values={bars} />
      </div>
      <p className="mt-4 text-sm font-medium text-muted">{label}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[30px] font-semibold leading-none tracking-tight tabular-nums text-foreground">{value}</span>
        {delta ? (
          <span className={cn("text-sm font-medium", badgeTone === "positive" ? "text-emerald-700 dark:text-emerald-400" : badgeTone === "warning" ? "text-amber-700 dark:text-amber-400" : "text-muted")}>
            {delta}
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="truncate text-sm text-muted">{sublabel}</span>
        <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium", badgeTone === "positive" ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : badgeTone === "warning" ? "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400" : "border-line bg-surface-2 text-muted")}>
          {badge}
        </span>
      </div>
    </div>
  );
}

function RevenueLineChart({ series }: { series: Array<{ label: string; revenue: number }> }) {
  if (series.length === 0) {
    return <p className="py-10 text-center text-sm text-muted">Select a valid date range to view analytics.</p>;
  }
  const w = 820;
  const h = 260;
  const pad = { l: 54, r: 14, t: 16, b: 30 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const values = series.map((s) => s.revenue);
  const rawMax = Math.max(...values, 1);
  const rawMin = Math.min(...values, 0);
  const span = Math.max(1, rawMax - rawMin);
  const min = Math.max(0, Math.floor((rawMin - span * 0.12) / 100) * 100);
  const max = Math.ceil((rawMax + span * 0.12) / 100) * 100;
  const range = Math.max(1, max - min);
  const x = (i: number) => pad.l + (i / Math.max(1, series.length - 1)) * innerW;
  const y = (v: number) => pad.t + innerH - ((v - min) / range) * innerH;
  const line = series.map((s, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(s.revenue).toFixed(2)}`).join(" ");
  const area = `${line} L ${x(series.length - 1).toFixed(2)} ${(pad.t + innerH).toFixed(2)} L ${x(0).toFixed(2)} ${(pad.t + innerH).toFixed(2)} Z`;
  const labelStep = Math.max(1, Math.ceil(series.length / 8));
  const last = series[series.length - 1];
  const orange = "rgb(var(--accent))";
  const yTicks = 5;
  const xTicks = Math.min(10, Math.max(4, Math.floor(series.length / 4)));

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-[260px] w-full min-w-[620px]" role="img" aria-label="Market-style revenue trend (PKR)">
        <defs>
          <linearGradient id="revFillOrangeFx" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={orange} stopOpacity="0.22" />
            <stop offset="100%" stopColor={orange} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {/* Forex-style grid: horizontal */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const t = i / yTicks;
          const gy = pad.t + innerH * t;
          const val = Math.round(max - range * t);
          return (
            <g key={`hy-${i}`}>
              <line x1={pad.l} x2={w - pad.r} y1={gy} y2={gy} stroke="rgb(var(--line))" strokeWidth="1" opacity={i === yTicks ? 0.9 : 0.55} />
              <text x={pad.l - 8} y={gy + 3.5} textAnchor="end" fontSize="9.5" fill="rgb(var(--muted))">
                {formatCurrency(val, true)}
              </text>
            </g>
          );
        })}
        {/* Forex-style grid: vertical */}
        {Array.from({ length: xTicks + 1 }, (_, i) => {
          const gx = pad.l + (innerW * i) / xTicks;
          return <line key={`vx-${i}`} x1={gx} x2={gx} y1={pad.t} y2={pad.t + innerH} stroke="rgb(var(--line))" strokeWidth="1" opacity="0.45" />;
        })}
        <path d={area} fill="url(#revFillOrangeFx)" />
        <path d={line} fill="none" stroke={orange} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {series.map((s, i) =>
          i % labelStep === 0 || i === series.length - 1 ? (
            <text key={`lx-${i}`} x={x(i)} y={h - 8} textAnchor="middle" fontSize="9.5" fill="rgb(var(--muted))">
              {s.label}
            </text>
          ) : null,
        )}
        {/* Last price marker (trading style) */}
        {last ? (
          <g>
            <line x1={pad.l} x2={w - pad.r} y1={y(last.revenue)} y2={y(last.revenue)} stroke={orange} strokeWidth="1" strokeDasharray="4 3" opacity="0.5" />
            <circle cx={x(series.length - 1)} cy={y(last.revenue)} r="3.5" fill={orange} />
            <rect x={w - pad.r - 72} y={y(last.revenue) - 10} width="72" height="20" rx="4" fill={orange} />
            <text x={w - pad.r - 36} y={y(last.revenue) + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="white">
              {formatCurrency(last.revenue, true)}
            </text>
          </g>
        ) : null}
      </svg>
      <div className="mt-1 flex items-center gap-3 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="inline-flex h-2.5 w-2.5 rounded-full bg-accent" aria-hidden /> Revenue (PKR)</span>
        <span>Market-style grid · moves up/down</span>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { tenants } = useTenants();
  const { openOnboarding, openPalette } = useOverlays();
  const activeBusinesses = tenants.filter((tenant) => tenant.status === "active").length;
  const terminals = tenants.reduce((sum, tenant) => sum + tenant.terminals, 0);
  const business = tenants[0];

  const today = useMemo(() => new Date(), []);
  const [start, setStart] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 29);
    return isoDate(d);
  });
  const [end, setEnd] = useState(() => isoDate(today));
  const series = useMemo(() => getRevenueSeries(start, end), [start, end]);
  const rangeTotal = series.reduce((sum, p) => sum + p.revenue, 0);

  const activity = business
    ? [
        { title: "Cloud sync healthy", detail: `${business.name} · last sync ${business.lastSync}`, time: "Now", icon: Wifi, tone: "text-emerald-600 dark:text-emerald-400" },
        { title: "Business profile active", detail: `Plan: ${business.plan.toUpperCase()} · ${terminals} terminals`, time: "Today", icon: CircleCheckBig, tone: "text-accent" },
        { title: "Panel ready", detail: `${INDUSTRY_BY_KEY[business.industry].label} panel configured`, time: "This week", icon: LayoutPanelTop, tone: "text-muted" },
        { title: "Status", detail: `Current status: ${business.status}`, time: "Updated", icon: Clock3, tone: "text-muted" },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Overview of your business performance and activity.</p>
        </div>
        <button
          type="button"
          onClick={openPalette}
          className="focus-ring flex h-10 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm text-muted transition-colors hover:border-line-strong hover:text-foreground lg:w-[320px]"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <span className="flex-1 truncate">Search businesses, panels, settings…</span>
        </button>
      </div>

      <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Monthly recurring revenue" value={formatCurrency(GLOBAL_METRICS.mrr)} delta={`${GLOBAL_METRICS.mrrDelta}%`} badge="MRR" badgeTone="neutral" sublabel="PKR · monthly" icon={TrendingUp} bars={[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]} />
        <KpiCard label="Active businesses" value={String(activeBusinesses)} badge={`${GLOBAL_METRICS.outlets} outlet`} badgeTone="neutral" sublabel={`${terminals} POS terminals`} icon={Building2} bars={[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]} />
        <KpiCard label="Sync status" value={formatPercent(GLOBAL_METRICS.syncRate, 2)} delta="0%" badge="24h" badgeTone="neutral" sublabel={`${GLOBAL_METRICS.offlineQueues} queued`} icon={Wifi} bars={[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]} />
        <KpiCard label="Retention" value={formatPercent(GLOBAL_METRICS.retention, 1)} delta="0%" badge="Retention" badgeTone="neutral" sublabel={`Churn ${formatPercent(GLOBAL_METRICS.churn, 1)}`} icon={ShieldCheck} bars={[0, 0, 0, 0, 0, 0, 0, 0, 0, 0]} />
      </section>

      <section aria-label="Analytics" className="rounded-xl border border-line bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Analytics</h2>
            <p className="mt-0.5 text-sm text-muted">Revenue trend (PKR). Select any date range (day/month/year).</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-muted">
              <span className="mb-1 block">From</span>
              <input type="date" value={start} max={end} onChange={(e) => setStart(e.target.value)} className="focus-ring h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-foreground" />
            </label>
            <label className="text-xs font-medium text-muted">
              <span className="mb-1 block">To</span>
              <input type="date" value={end} min={start} max={isoDate(today)} onChange={(e) => setEnd(e.target.value)} className="focus-ring h-9 rounded-lg border border-line bg-surface-2 px-2.5 text-sm text-foreground" />
            </label>
            <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
              <span className="text-muted">Range total: </span>
              <span className="font-semibold tabular-nums text-foreground">{formatCurrency(rangeTotal)}</span>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <RevenueLineChart series={series} />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-1">
          <h2 className="text-base font-semibold text-foreground">Business snapshot</h2>
          <p className="mt-0.5 text-sm text-muted">Your active business details.</p>
          {business ? (
            <div className="mt-4 space-y-3">
              <div className="flex items-start gap-3">
                <IndustryGlyph industry={business.industry} />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{business.name}</p>
                  <p className="text-xs text-muted">{business.uid} · {business.location}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={business.status} />
                <PlanBadge plan={business.plan} />
              </div>
              <dl className="grid grid-cols-2 gap-2 rounded-lg bg-surface-2 p-3 text-sm">
                <div><dt className="text-xs text-muted">Category panel</dt><dd className="font-medium text-foreground">{INDUSTRY_BY_KEY[business.industry].shortLabel}</dd></div>
                <div><dt className="text-xs text-muted">MRR (PKR)</dt><dd className="font-medium tabular-nums text-foreground">{formatCurrency(business.mrr)}</dd></div>
                <div><dt className="text-xs text-muted">Terminals</dt><dd className="font-medium text-foreground">{business.terminals}</dd></div>
                <div><dt className="text-xs text-muted">Sync</dt><dd className="font-medium text-foreground">{business.lastSync}</dd></div>
              </dl>
              <Link href={`/store/${business.id}`} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
                Open store panel <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No business yet.</p>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-1">
          <h2 className="text-base font-semibold text-foreground">Recent activity</h2>
          <p className="mt-0.5 text-sm text-muted">Relevant updates for your business.</p>
          <ul className="mt-4 space-y-3">
            {activity.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.title} className="flex gap-3">
                  <span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2", item.tone)}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-xs text-muted">{item.detail}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{item.time}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-xl border border-line bg-surface p-5 lg:col-span-1">
          <h2 className="text-base font-semibold text-foreground">Quick actions</h2>
          <p className="mt-0.5 text-sm text-muted">Common admin tasks.</p>
          <div className="mt-4 space-y-1">
            <button type="button" onClick={() => openOnboarding()} className="focus-ring flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-2">
              <span className="flex items-center gap-2"><Plus className="h-4 w-4 text-accent" aria-hidden /> New business</span>
              <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
            </button>
            <Link href="/tenants" className="focus-ring flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-surface-2">
              <span className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted" aria-hidden /> View business</span>
              <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
            </Link>
            {business ? (
              <Link href={`/store/${business.id}`} target="_blank" rel="noopener noreferrer" className="focus-ring flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-surface-2">
                <span className="flex items-center gap-2"><LayoutPanelTop className="h-4 w-4 text-muted" aria-hidden /> Open store panel</span>
                <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
              </Link>
            ) : null}
            <Link href="/settings" className="focus-ring flex items-center justify-between rounded-lg px-3 py-2.5 text-sm text-foreground hover:bg-surface-2">
              <span className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-muted" aria-hidden /> Platform &amp; admin settings</span>
              <ArrowRight className="h-4 w-4 text-muted" aria-hidden />
            </Link>
          </div>
        </div>
      </section>

      <TenantTable title="Business" description="Your business details (1 business)" />
    </div>
  );
}
