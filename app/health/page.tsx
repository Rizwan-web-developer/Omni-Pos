"use client";

import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Cloud, Database, RefreshCw, Server } from "lucide-react";

type StatusRow = { id: string; uid?: string | null; businessName: string; status: string; syncState: string; pendingQueue: number; lastHeartbeat: string; terminals: number; location?: string | null };
type LogRow = { id: string; level: string; status: string; source: string; message: string; pendingQueue: number; createdAt: string; tenant?: { businessName: string } | null };

export default function HealthPage() {
  const [data, setData] = useState<{ summary: { businesses: number; synced: number; pending: number; totalPendingQueue: number }; status: StatusRow[]; logs: LogRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setData(json);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const s = data?.summary;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Sync &amp; System Health</h1>
          <p className="mt-1 text-sm text-muted">Offline-first sync status, pending queues, and system logs (monitoring foundation).</p>
        </div>
        <button type="button" onClick={() => void load()} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
          <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
        </button>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-5"><div className="flex items-center gap-2 text-muted"><Server className="h-4 w-4" /><span className="text-sm font-medium">Businesses monitored</span></div><p className="mt-2 text-2xl font-semibold text-foreground">{s?.businesses ?? "—"}</p></div>
        <div className="rounded-xl border border-line bg-surface p-5"><div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" /><span className="text-sm font-medium text-muted">Cloud sync OK</span></div><p className="mt-2 text-2xl font-semibold text-foreground">{s?.synced ?? "—"}</p></div>
        <div className="rounded-xl border border-line bg-surface p-5"><div className="flex items-center gap-2 text-amber-600 dark:text-amber-400"><AlertTriangle className="h-4 w-4" /><span className="text-sm font-medium text-muted">Pending / offline</span></div><p className="mt-2 text-2xl font-semibold text-foreground">{s?.pending ?? "—"}</p></div>
        <div className="rounded-xl border border-line bg-surface p-5"><div className="flex items-center gap-2 text-muted"><Database className="h-4 w-4" /><span className="text-sm font-medium">Total pending queue</span></div><p className="mt-2 text-2xl font-semibold text-foreground">{s?.totalPendingQueue ?? "—"}</p></div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground">Cloud vs local sync status (per business)</h2>
        <p className="mt-0.5 text-sm text-muted">Which businesses are synced and which have pending offline queues.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead><tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted"><th className="pb-2 pr-3">Business</th><th className="pb-2 pr-3">Status</th><th className="pb-2 pr-3">Sync</th><th className="pb-2 pr-3">Pending queue</th><th className="pb-2 pr-3">Terminals</th><th className="pb-2">Last heartbeat</th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="py-6 text-muted">Loading…</td></tr> : (data?.status?.length ? data.status : []).length === 0 ? <tr><td colSpan={6} className="py-6 text-muted">No businesses found.</td></tr> : data!.status.map((row) => (
                <tr key={row.id} className="border-b border-line/70 last:border-0">
                  <td className="py-2.5 pr-3"><p className="font-medium text-foreground">{row.businessName}</p><p className="text-xs text-muted">{row.uid ?? row.id}</p></td>
                  <td className="py-2.5 pr-3"><span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${row.status === "OFFLINE" ? "border-rose-600/20 bg-rose-500/10 text-rose-700 dark:text-rose-400" : "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"}`}>{row.status}</span></td>
                  <td className="py-2.5 pr-3"><span className="inline-flex items-center gap-1.5 text-muted"><Cloud className="h-3.5 w-3.5" />{row.syncState === "SYNCED" ? "Synced" : "Pending offline"}</span></td>
                  <td className="py-2.5 pr-3 tabular-nums text-foreground">{row.pendingQueue}</td>
                  <td className="py-2.5 pr-3 tabular-nums text-muted">{row.terminals}</td>
                  <td className="py-2.5 text-muted">{new Date(row.lastHeartbeat).toLocaleString("en-PK")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-base font-semibold text-foreground">System / sync logs</h2>
        <p className="mt-0.5 text-sm text-muted">Recent events (API/sync/system). Real telemetry can be wired from POS clients.</p>
        <div className="mt-4 space-y-2">
          {loading ? <p className="text-sm text-muted">Loading…</p> : (data?.logs?.length ? data.logs : []).length === 0 ? (
            <div className="rounded-lg border border-dashed border-line bg-surface-2/30 p-4 text-sm text-muted">
              <p className="flex items-center gap-2 font-medium text-foreground"><Activity className="h-4 w-4 text-accent" /> No log events yet</p>
              <p className="mt-1">When POS terminals sync or errors occur, events will appear here. Monitoring hooks (uptime/API/error logs) can be integrated next.</p>
            </div>
          ) : data!.logs.map((log) => (
            <div key={log.id} className="flex items-start justify-between gap-3 rounded-lg border border-line bg-surface-2/30 px-3 py-2.5">
              <div className="min-w-0"><p className="text-sm font-medium text-foreground">{log.message}</p><p className="text-xs text-muted">{log.tenant?.businessName ? `${log.tenant.businessName} · ` : ""}{log.source} · {log.level}/{log.status}</p></div>
              <span className="shrink-0 text-xs text-muted">{new Date(log.createdAt).toLocaleString("en-PK")}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
