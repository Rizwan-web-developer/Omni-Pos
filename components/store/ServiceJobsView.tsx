"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Plus, Trash2, Wrench, X } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn, formatCurrency } from "@/lib/utils";

type ServiceJob = {
  id: string;
  jobNumber: string;
  customerName: string;
  customerPhone?: string | null;
  device: string;
  issue?: string | null;
  notes?: string | null;
  status: "RECEIVED" | "IN_PROGRESS" | "READY" | "DELIVERED" | "CANCELLED";
  estimatePkr: number;
  deliveredAt?: string | null;
  createdAt: string;
};

const STATUSES: Array<{ key: ServiceJob["status"]; label: string; tone: string }> = [
  { key: "RECEIVED", label: "Received", tone: "border-line bg-surface-2 text-muted" },
  { key: "IN_PROGRESS", label: "In progress", tone: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  { key: "READY", label: "Ready", tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { key: "DELIVERED", label: "Delivered", tone: "border-line bg-surface-2 text-foreground" },
  { key: "CANCELLED", label: "Cancelled", tone: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300" },
];

function statusMeta(status: ServiceJob["status"]) {
  return STATUSES.find((s) => s.key === status) ?? STATUSES[0];
}

export function ServiceJobsView({ businessId }: { businessId: string }) {
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<"ALL" | ServiceJob["status"]>("ALL");
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<ServiceJob | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [device, setDevice] = useState("");
  const [issue, setIssue] = useState("");
  const [estimate, setEstimate] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/businesses/${businessId}/service-jobs`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load service jobs.");
      setJobs(Array.isArray(data.jobs) ? data.jobs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load service jobs.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const counts = useMemo(() => {
    return {
      open: jobs.filter((j) => j.status === "RECEIVED" || j.status === "IN_PROGRESS").length,
      ready: jobs.filter((j) => j.status === "READY").length,
      total: jobs.length,
    };
  }, [jobs]);

  const visible = useMemo(() => (filter === "ALL" ? jobs : jobs.filter((j) => j.status === filter)), [jobs, filter]);

  const resetForm = () => {
    setCustomerName(""); setCustomerPhone(""); setDevice(""); setIssue(""); setEstimate("");
  };

  const createJob = async () => {
    setError(""); setNotice("");
    if (customerName.trim().length < 2) { setError("Customer name likhein."); return; }
    if (device.trim().length < 2) { setError("Device / item likhein."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/service-jobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, customerPhone, device, issue, estimatePkr: Number(estimate || 0) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to create job.");
      setJobs((cur) => [data.job as ServiceJob, ...cur]);
      setAddOpen(false);
      resetForm();
      setNotice("Service job created.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create job.");
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (job: ServiceJob, status: ServiceJob["status"]) => {
    setError(""); setNotice("");
    try {
      const res = await fetch(`/api/businesses/${businessId}/service-jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to update job.");
      setJobs((cur) => cur.map((j) => (j.id === job.id ? (data.job as ServiceJob) : j)));
      setNotice(`${job.jobNumber} → ${statusMeta(status).label}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update job.");
    }
  };

  const removeJob = async () => {
    if (!del) return;
    setDelBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/service-jobs/${del.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete job.");
      setJobs((cur) => cur.filter((j) => j.id !== del.id));
      setDel(null);
      setNotice("Service job deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete job.");
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-foreground"><Wrench className="h-5 w-5 text-accent" /> Service Jobs</h1>
          <p className="mt-0.5 text-sm text-muted">Repair / service job cards — received → in progress → ready → delivered.</p>
        </div>
        <button type="button" onClick={() => { resetForm(); setAddOpen(true); }} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          <Plus className="h-4 w-4" /> New job card
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Open jobs", String(counts.open), "received + in progress"],
          ["Ready for pickup", String(counts.ready), "customer notified"],
          ["All jobs", String(counts.total), "total job cards"],
        ].map(([label, value, hint]) => (
          <div key={label} className="rounded-xl border border-line bg-surface p-4">
            <p className="text-xs font-medium text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</p>
            <p className="mt-0.5 text-xs text-muted">{hint}</p>
          </div>
        ))}
      </div>

      {error ? <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</div> : null}
      {notice ? <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</div> : null}

      <div className="flex flex-wrap gap-1.5">
        {(["ALL", ...STATUSES.map((s) => s.key)] as const).map((key) => (
          <button key={key} type="button" onClick={() => setFilter(key as any)} className={cn("focus-ring rounded-lg border px-3 py-1.5 text-xs font-medium", filter === key ? "border-accent-line bg-accent-soft text-accent" : "border-line bg-surface text-muted hover:text-foreground")}>
            {key === "ALL" ? "All" : statusMeta(key as ServiceJob["status"]).label}
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-line bg-surface">
        {loading ? (
          <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading jobs…</div>
        ) : visible.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-muted">No service jobs here. Create a job card for a repair.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-xs font-semibold uppercase tracking-[0.04em] text-muted">
                  <th className="px-4 py-2.5">Job</th>
                  <th className="px-3 py-2.5">Customer</th>
                  <th className="px-3 py-2.5">Device / issue</th>
                  <th className="px-3 py-2.5 text-right">Estimate</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((job) => {
                  const meta = statusMeta(job.status);
                  return (
                    <tr key={job.id} className="border-b border-line last:border-b-0">
                      <td className="px-4 py-3">
                        <p className="font-mono text-xs font-medium text-foreground">{job.jobNumber}</p>
                        <p className="text-xs text-muted">{new Date(job.createdAt).toLocaleString("en-PK")}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-foreground">{job.customerName}</p>
                        {job.customerPhone ? <p className="text-xs text-muted">{job.customerPhone}</p> : null}
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-foreground">{job.device}</p>
                        {job.issue ? <p className="max-w-xs text-xs text-muted">{job.issue}</p> : null}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold tabular-nums text-foreground">{formatCurrency(job.estimatePkr)}</td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium", meta.tone)}>{meta.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center justify-end gap-1.5">
                          <select
                            value={job.status}
                            onChange={(e) => void setStatus(job, e.target.value as ServiceJob["status"])}
                            className="focus-ring h-8 rounded-md border border-line bg-surface-2 px-2 text-xs text-foreground"
                            aria-label={`Change status for ${job.jobNumber}`}
                          >
                            {STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                          </select>
                          {job.status === "READY" ? (
                            <button type="button" onClick={() => void setStatus(job, "DELIVERED")} className="focus-ring inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" /> Deliver</button>
                          ) : null}
                          <button type="button" onClick={() => setDel(job)} className="focus-ring rounded-md border border-line bg-surface-2 p-1.5 text-muted hover:border-rose-400/40 hover:text-rose-600" aria-label="Delete job"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {addOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="New service job">
          <div className="absolute inset-0 bg-overlay/65 backdrop-blur-sm" onMouseDown={() => (saving ? null : setAddOpen(false))} aria-hidden />
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl border border-line bg-surface p-5 shadow-panel sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">New service job card</h2>
              <button type="button" onClick={() => (saving ? null : setAddOpen(false))} className="rounded-md p-1 text-muted hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Customer name *</span>
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Phone</span>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
              </label>
              <label className="text-sm sm:col-span-2"><span className="mb-1 block text-xs font-medium text-muted">Device / item *</span>
                <input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="e.g. iPhone 13 — screen replacement" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
              </label>
              <label className="text-sm sm:col-span-2"><span className="mb-1 block text-xs font-medium text-muted">Issue / work required</span>
                <textarea value={issue} onChange={(e) => setIssue(e.target.value)} rows={2} className="focus-ring w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground" />
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Estimate ($)</span>
                <input type="number" min="0" step="0.01" value={estimate} onChange={(e) => setEstimate(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setAddOpen(false)} className="focus-ring rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-foreground disabled:opacity-50">Cancel</button>
              <button type="button" disabled={saving} onClick={() => void createJob()} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create job
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!del}
        onClose={() => (delBusy ? undefined : setDel(null))}
        onConfirm={() => void removeJob()}
        title="Delete service job?"
        description={del ? <span>{del.jobNumber} ({del.device}) delete ho jayega.</span> : null}
        confirmLabel="Delete"
        tone="danger"
        loading={delBusy}
      />
    </div>
  );
}
