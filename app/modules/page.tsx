"use client";

import { useEffect, useState } from "react";
import { Boxes, Check, RefreshCw, SlidersHorizontal } from "lucide-react";

type ModuleConfig = { id: string; industryType: string; displayName: string; enabled: boolean; description?: string | null; features?: Record<string, boolean> | null };

function label(key: string) {
  return key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase());
}

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/modules", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setModules(data.modules || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const toggleModule = async (m: ModuleConfig) => {
    setSaving(m.id);
    try {
      const res = await fetch("/api/modules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, enabled: !m.enabled }) });
      const data = await res.json();
      if (res.ok && data.module) setModules((prev) => prev.map((x) => (x.id === m.id ? data.module : x)));
    } finally {
      setSaving(null);
    }
  };

  const toggleFeature = async (m: ModuleConfig, key: string) => {
    setSaving(m.id + key);
    const features = { ...(m.features || {}), [key]: !(m.features || {})[key] };
    try {
      const res = await fetch("/api/modules", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: m.id, features }) });
      const data = await res.json();
      if (res.ok && data.module) setModules((prev) => prev.map((x) => (x.id === m.id ? data.module : x)));
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Industry Modules Control</h1>
          <p className="mt-1 text-sm text-muted">Manage which features are enabled per industry (IMEI, expiry/batch, etc.). Changes apply to that industry&apos;s panel behavior.</p>
        </div>
        <button type="button" onClick={() => void load()} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
          <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {loading ? <div className="rounded-xl border border-line bg-surface p-6 text-sm text-muted">Loading modules…</div> : modules.map((m) => (
          <section key={m.id} className="rounded-xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-2 text-accent"><Boxes className="h-5 w-5" aria-hidden /></span>
                <div>
                  <h2 className="text-base font-semibold text-foreground">{m.displayName}</h2>
                  <p className="text-xs text-muted">{m.industryType}{m.description ? ` · ${m.description}` : ""}</p>
                </div>
              </div>
              <button
                type="button"
                disabled={saving === m.id}
                onClick={() => void toggleModule(m)}
                className={`focus-ring rounded-full border px-3 py-1 text-xs font-semibold ${m.enabled ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-line bg-surface-2 text-muted"}`}
              >
                {m.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
            <div className="mt-4 rounded-lg border border-line bg-surface-2/40 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><SlidersHorizontal className="h-3.5 w-3.5" /> Feature toggles</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(m.features || {}).map(([key, val]) => (
                  <button
                    key={key}
                    type="button"
                    disabled={saving === m.id + key}
                    onClick={() => void toggleFeature(m, key)}
                    className={`focus-ring inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium ${val ? "border-accent-line bg-accent-soft text-accent" : "border-line bg-surface text-muted"}`}
                  >
                    {val ? <Check className="h-3.5 w-3.5" aria-hidden /> : null}
                    {label(key)}
                  </button>
                ))}
                {Object.keys(m.features || {}).length === 0 ? <span className="text-xs text-muted">No feature flags configured.</span> : null}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
