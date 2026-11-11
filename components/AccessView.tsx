"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Check,
  CheckCircle2,
  Info,
  KeyRound,
  Loader2,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { INDUSTRY_BY_KEY } from "@/lib/data";
import type { IndustryKey } from "@/lib/types";
import { cn } from "@/lib/utils";

type BusinessRow = {
  id: string;
  uid?: string | null;
  businessName: string;
  industryType: string;
  status: string;
  accountType: string;
  subscriptionTier: string;
  features: string[];
};

type CatalogFeature = {
  key: string;
  label: string;
  short: string;
  description: string;
  group: string;
  recommendedFor: IndustryKey[];
};

type AccessPayload = {
  businesses: BusinessRow[];
  catalog: CatalogFeature[];
  core: Array<{ label: string; description: string }>;
  groups: string[];
  industryRecommendations: Record<string, string[]>;
};

const INDUSTRY_KEY: Record<string, IndustryKey> = {
  MOBILE_ACCESSORIES: "mobile",
  PHARMACY: "pharmacy",
  GROCERY: "grocery",
  ELECTRONICS: "electronics",
  HARDWARE_SHOP: "hardware-shop",
  PAINT_SHOP: "paint-shop",
  COSMETICS_SHOP: "cosmetics-shop",
};

function industryKey(value: string): IndustryKey {
  return INDUSTRY_KEY[value] ?? "electronics";
}

function industryLabel(value: string): string {
  return INDUSTRY_BY_KEY[industryKey(value)]?.label ?? value;
}

export function AccessView() {
  const [data, setData] = useState<AccessPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/access", { cache: "no-store" });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.error || payload?.message || "Failed to load access data.");
      setData(payload as AccessPayload);
      setSelectedId((current) => current ?? payload.businesses?.[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load access data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => data?.businesses.find((business) => business.id === selectedId) ?? null,
    [data, selectedId],
  );

  useEffect(() => {
    if (!selected) return;
    setDraft(new Set(selected.features ?? []));
    setNotice(null);
  }, [selected?.id, selected?.features]);

  const filteredBusinesses = useMemo(() => {
    const list = data?.businesses ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (business) =>
        business.businessName.toLowerCase().includes(q) ||
        (business.uid ?? "").toLowerCase().includes(q) ||
        industryLabel(business.industryType).toLowerCase().includes(q),
    );
  }, [data, search]);

  const grouped = useMemo(() => {
    const catalog = data?.catalog ?? [];
    const groups = data?.groups ?? [];
    return groups.map((group) => ({
      group,
      features: catalog.filter((feature) => feature.group === group),
    }));
  }, [data]);

  const toggle = (key: string) => {
    setDraft((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setNotice(null);
  };

  const applyRecommended = () => {
    if (!selected || !data) return;
    const recommended = data.industryRecommendations[selected.industryType] ?? [];
    setDraft(new Set(recommended));
    setNotice({ tone: "ok", text: "Industry recommendations applied. Press Save access to publish." });
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/access", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId: selected.id, features: Array.from(draft) }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Failed to save access.");
      const saved: string[] = Array.isArray(payload.features) ? payload.features : Array.from(draft);
      setData((current) =>
        current
          ? {
              ...current,
              businesses: current.businesses.map((business) =>
                business.id === selected.id ? { ...business, features: saved } : business,
              ),
            }
          : current,
      );
      setDraft(new Set(saved));
      setNotice({ tone: "ok", text: `${selected.businessName}: access saved (${saved.length} features).` });
    } catch (err) {
      setNotice({ tone: "err", text: err instanceof Error ? err.message : "Failed to save access." });
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = draft.size;
  const industry = selected ? industryKey(selected.industryType) : null;
  const recommendations = selected ? data?.industryRecommendations[selected.industryType] ?? [] : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5 text-xs font-medium text-muted">
            <span>Administration</span>
            <span className="text-line-strong">/</span>
            <span>Feature access</span>
          </div>
          <h1 className="mt-2 flex items-center gap-2.5 text-[28px] font-semibold tracking-tight text-foreground sm:text-[32px]">
            <KeyRound className="h-7 w-7 text-accent" aria-hidden />
            Access control
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Tick a feature to grant it to a business. Unticking removes the feature from their panel. Bulk-quantity
            stock, POS and invoices are always included for every business.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:border-line-strong"
        >
          <Sparkles className={cn("h-4 w-4", loading && "animate-pulse")} aria-hidden />
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.6fr)]">
        <section className="rounded-xl border border-line bg-surface p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">Businesses</h2>
            <span className="rounded-md border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">
              {data?.businesses.length ?? 0}
            </span>
          </div>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search business, ID or industry…"
              className="focus-ring h-9 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted"
            />
          </div>
          <div className="mt-3 max-h-[560px] space-y-2 overflow-auto pr-1">
            {loading ? (
              <p className="py-6 text-sm text-muted">Loading businesses…</p>
            ) : filteredBusinesses.length === 0 ? (
              <p className="py-6 text-sm text-muted">No businesses found.</p>
            ) : (
              filteredBusinesses.map((business) => {
                const active = business.id === selectedId;
                const count = business.features?.length ?? 0;
                return (
                  <button
                    key={business.id}
                    type="button"
                    onClick={() => setSelectedId(business.id)}
                    className={cn(
                      "w-full rounded-lg border p-3 text-left transition-colors",
                      active ? "border-accent-line bg-accent-soft/50" : "border-line bg-surface-2/40 hover:border-line-strong",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {business.businessName}{" "}
                          <span className="text-xs font-normal text-muted">{business.uid || ""}</span>
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                          <Building2 className="h-3 w-3" aria-hidden />
                          {industryLabel(business.industryType)} · {business.accountType}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium",
                          count > 0
                            ? "border-accent-line bg-accent-soft text-accent"
                            : "border-line bg-surface text-muted",
                        )}
                      >
                        {count} features
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
          {!selected ? (
            <p className="py-10 text-center text-sm text-muted">Select a business to manage its access.</p>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold text-foreground">{selected.businessName}</h2>
                  <p className="mt-0.5 text-sm text-muted">
                    {industryLabel(selected.industryType)} · {selected.status} · {selected.accountType}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={applyRecommended}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-medium text-foreground hover:border-line-strong"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden />
                    Apply recommended
                  </button>
                  <button
                    type="button"
                    onClick={() => void save()}
                    disabled={saving}
                    className="focus-ring inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-60"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                    {saving ? "Saving…" : "Save access"}
                  </button>
                </div>
              </div>

              {notice ? (
                <div
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm",
                    notice.tone === "ok"
                      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300"
                      : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
                  )}
                >
                  {notice.text}
                </div>
              ) : null}

              <div className="rounded-lg border border-line bg-surface-2/50 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" aria-hidden />
                  Always included (core)
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(data?.core ?? []).map((core) => (
                    <div key={core.label} className="flex items-start gap-2 rounded-md border border-line bg-surface px-2.5 py-2">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-xs font-semibold text-foreground">{core.label}</span>
                        <span className="block text-xs text-muted">{core.description}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Optional features ({enabledCount} enabled)
                </p>
                <p className="text-xs text-muted">Unchecked = feature removed from panel</p>
              </div>

              <div className="space-y-5">
                {grouped.map(({ group, features }) => (
                  <div key={group}>
                    <p className="mb-2 text-sm font-semibold text-foreground">{group}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {features.map((feature) => {
                        const checked = draft.has(feature.key);
                        const recommended = industry ? feature.recommendedFor.includes(industry) : false;
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
                              onChange={() => toggle(feature.key)}
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
                              <span className="mt-0.5 block text-xs leading-relaxed text-muted">{feature.description}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {recommendations.length > 0 ? (
                <p className="flex items-start gap-1.5 text-xs text-muted">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {industryLabel(selected.industryType)} ke liye recommended set: {recommendations.length} features. Aap
                  apni marzi se koi bhi checkbox on/off kar sakte hain.
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 border-t border-line pt-4">
                <button
                  type="button"
                  onClick={() => setDraft(new Set(selected.features ?? []))}
                  className="focus-ring rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:border-line-strong"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CheckCircle2 className="h-4 w-4" aria-hidden />}
                  {saving ? "Saving…" : "Save access"}
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
