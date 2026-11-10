"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  Lock,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Wallet,
} from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn, formatCurrency } from "@/lib/utils";

const PACKAGE_PKR = 15000;
const daysFor = (n: number) => Math.max(1, n) * 30 + 5; // 1=>35, 2=>65

type Biz = {
  id: string; uid?: string | null; businessName: string; status: string; accountType: string; isActive: boolean;
  subscriptionPaidUntil?: string | null; lastPaidAt?: string | null; email?: string | null; phone?: string | null;
  paid: boolean; paidWindowValid: boolean; voucherPaid: number; voucherUnpaid: number;
};
type Voucher = {
  id: string; tenantId: string; year: number; month: number; label: string; amountPkr: number;
  status: "UNPAID" | "PAID" | "CANCELLED"; paidAt?: string | null; validUntil?: string | null; notes?: string | null;
};

function fmtDT(v?: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}
function isExpired(v?: string | null) {
  if (!v) return false;
  return new Date(v).getTime() <= Date.now();
}

export default function BillingPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState<Biz[]>([]);
  const [metrics, setMetrics] = useState({ mrr: 0, activePaid: 0, realActive: 0, businesses: 0 });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [vLoading, setVLoading] = useState(false);
  const [year, setYear] = useState<number>(currentYear);
  const [monthSearch, setMonthSearch] = useState("");
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [working, setWorking] = useState<string | null>(null);
  const [confirmPaid, setConfirmPaid] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const selected = useMemo(() => businesses.find((b) => b.id === selectedId) || null, [businesses, selectedId]);
  const pickedIds = useMemo(() => Object.keys(picked).filter((k) => picked[k]), [picked]);
  const pickedCount = pickedIds.length;

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/billing/plans", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || "Failed to load");
      setBusinesses(data.businesses || []);
      setMetrics(data.metrics || { mrr: 0, activePaid: 0, realActive: 0, businesses: 0 });
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);

  const loadVouchers = useCallback(async (tenantId: string) => {
    setVLoading(true);
    try {
      const res = await fetch(`/api/billing/vouchers?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setVouchers(data.vouchers || []);
    } finally { setVLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (selectedId) { setPicked({}); setMonthSearch(""); setNotice(null); setYear(currentYear); void loadVouchers(selectedId); } else { setVouchers([]); setPicked({}); } }, [selectedId, loadVouchers, currentYear]);

  const clampYear = (y: number) => Math.max(currentYear, Math.min(2100, Math.floor(y || currentYear)));

  const generateYear = async () => {
    if (!selected) return;
    const y = clampYear(year);
    setYear(y); setWorking("generate"); setNotice(null);
    try {
      const res = await fetch("/api/billing/vouchers/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: selected.id, year: y }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setVouchers(data.vouchers || []); setPicked({});
      setNotice({ tone: "ok", text: data.message || `Vouchers generated for ${y}.` });
    } catch (e) { setNotice({ tone: "err", text: e instanceof Error ? e.message : "Failed to generate" }); }
    finally { setWorking(null); }
  };

  const markPaid = async () => {
    if (!selected || pickedIds.length === 0) return;
    setWorking("paid"); setNotice(null);
    try {
      const res = await fetch("/api/billing/vouchers/mark-paid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tenantId: selected.id, voucherIds: pickedIds }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setVouchers(data.vouchers || []); setPicked({}); setConfirmPaid(false);
      setNotice({ tone: "ok", text: data.message || `Marked paid. Valid for ${data.days} days.` });
      await load();
    } catch (e) { setNotice({ tone: "err", text: e instanceof Error ? e.message : "Failed to mark paid" }); }
    finally { setWorking(null); }
  };

  const filteredVouchers = useMemo(() => {
    const q = monthSearch.trim().toLowerCase();
    const base = vouchers; // show all years for context, filtered by search
    if (!q) return base;
    return base.filter((v) => v.label.toLowerCase().includes(q) || String(v.month).padStart(2, "0").includes(q) || String(v.month) === q);
  }, [vouchers, monthSearch]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-foreground">Subscriptions &amp; Billing</h1>
          <p className="mt-1 text-sm text-muted">Single package <span className="font-semibold text-foreground">PKR {PACKAGE_PKR.toLocaleString("en-PK")}</span> per business (full panel). Collect physically → mark Paid (exact date &amp; time) → 35 days, then auto-locked (data preserved).</p>
        </div>
        <button type="button" onClick={() => void load()} className="focus-ring inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} aria-hidden /> Refresh
        </button>
      </div>

      {error ? <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-line bg-surface p-5"><div className="flex items-center gap-2 text-muted"><Wallet className="h-4 w-4" /> <span className="text-sm font-medium">MRR (active paid)</span></div><p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(metrics.mrr)}</p><p className="text-xs text-muted">{metrics.activePaid} paid × {formatCurrency(PACKAGE_PKR)}</p></div>
        <div className="rounded-xl border border-line bg-surface p-5"><div className="flex items-center gap-2 text-muted"><BadgeCheck className="h-4 w-4" /> <span className="text-sm font-medium">Real &amp; Active = Paid</span></div><p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{metrics.realActive}</p><p className="text-xs text-muted">Real accounts Active (treated as paid)</p></div>
        <div className="rounded-xl border border-line bg-surface p-5"><div className="flex items-center gap-2 text-muted"><CheckCircle2 className="h-4 w-4" /> <span className="text-sm font-medium">Active paid</span></div><p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{metrics.activePaid}</p><p className="text-xs text-muted">Paid / within window</p></div>
        <div className="rounded-xl border border-line bg-surface p-5"><div className="flex items-center gap-2 text-muted"><CreditCard className="h-4 w-4" /> <span className="text-sm font-medium">Package</span></div><p className="mt-2 text-2xl font-semibold tabular-nums text-foreground">{formatCurrency(PACKAGE_PKR)}<span className="text-sm font-normal text-muted">/mo</span></p><p className="text-xs text-muted">1 = 35 days · 2 = 65 days (5-day grace). Guzre hue months ke voucher nahi bante.</p></div>
      </section>

      <section className="rounded-xl border border-accent-line bg-accent-soft/30 p-4 text-sm text-foreground">
        <p className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden /><span><span className="font-semibold">Rules:</span> vouchers sirf <b>aaj ({currentYear}-{String(currentMonth).padStart(2,"0")}) se aage</b> generate hote hain (past months/year nahi). Mark Paid = exact date &amp; time attach, <b>1→35 din</b>, <b>2→65 din</b>. Expiry par <b>auto-lock (Deactive)</b>, data preserved. Demo ko Real convert karo to wo usi waqt <b>paid</b> ho jata hai (current month voucher paid, 35 din). Real+Active = paid.</span></p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.25fr)]">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-base font-semibold text-foreground">Businesses (Real &amp; Active = Paid)</h2>
          <p className="mt-0.5 text-sm text-muted">Select a business to generate vouchers and mark payments.</p>
          <div className="mt-4 max-h-[520px] overflow-auto">
            {loading ? <p className="py-6 text-sm text-muted">Loading…</p> : businesses.length === 0 ? <p className="py-6 text-sm text-muted">No businesses yet.</p> : (
              <ul className="space-y-2">
                {businesses.map((b) => {
                  const sel = b.id === selectedId;
                  const expired = isExpired(b.subscriptionPaidUntil);
                  return (
                    <li key={b.id}>
                      <button type="button" onClick={() => setSelectedId(b.id)} className={cn("w-full rounded-lg border p-3 text-left transition-colors", sel ? "border-accent-line bg-accent-soft/40" : "border-line bg-surface-2/40 hover:border-line-strong")}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{b.businessName} <span className="text-xs font-normal text-muted">{b.uid || ""}</span></p>
                            <p className="text-xs text-muted">{b.accountType} · {b.status}{b.lastPaidAt ? ` · Paid ${fmtDT(b.lastPaidAt)}` : ""}</p>
                            <p className={cn("mt-0.5 text-xs", b.subscriptionPaidUntil && !expired ? "text-emerald-700 dark:text-emerald-400" : b.subscriptionPaidUntil && expired ? "text-rose-600 dark:text-rose-400" : "text-muted")}>
                              {b.subscriptionPaidUntil ? (expired ? `Expired ${fmtDT(b.subscriptionPaidUntil)} (auto-locked)` : `Valid until ${fmtDT(b.subscriptionPaidUntil)}`) : "No paid window set"}
                            </p>
                          </div>
                          <span className={cn("shrink-0 rounded-md border px-2 py-0.5 text-xs font-medium", b.paid ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400")}>{b.paid ? "PAID" : "UNPAID"}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="text-base font-semibold text-foreground">Vouchers &amp; Mark Paid</h2>
          {!selected ? (
            <p className="mt-3 text-sm text-muted">Select a business to generate vouchers and mark payments.</p>
          ) : (
            <div className="mt-3 space-y-4">
              <div className="rounded-lg border border-line bg-surface-2/40 p-3">
                <p className="text-sm font-semibold text-foreground">{selected.businessName}</p>
                <p className="text-xs text-muted">{selected.accountType} · {selected.status} · {selected.paid ? "Paid/Active" : "Not paid"}{selected.subscriptionPaidUntil ? ` · ${isExpired(selected.subscriptionPaidUntil) ? "expired" : "valid until"} ${fmtDT(selected.subscriptionPaidUntil)}` : ""}</p>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm text-foreground"><span className="mb-1 block text-xs font-medium text-muted">Year (current se aage)</span>
                  <input type="number" min={currentYear} max={2100} value={year} onChange={(e) => setYear(clampYear(Number(e.target.value)))} className="focus-ring h-9 w-28 rounded-lg border border-line bg-surface-2 px-2 text-sm text-foreground" />
                </label>
                <button type="button" disabled={!!working} onClick={() => void generateYear()} className="focus-ring inline-flex h-9 items-center gap-2 rounded-lg border border-accent-line bg-accent-soft px-3 text-sm font-semibold text-accent hover:opacity-90 disabled:opacity-60">
                  {working === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />} Generate monthly vouchers ({clampYear(year)})
                </button>
                <div className="relative min-w-[180px] flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                  <input type="text" value={monthSearch} onChange={(e) => setMonthSearch(e.target.value)} placeholder="Search month (e.g. 11, 2026-11)" className="focus-ring h-9 w-full rounded-lg border border-line bg-surface-2 pl-8 pr-2 text-sm text-foreground" />
                </div>
              </div>
              <p className="text-xs text-muted">Sirf {currentYear}-{String(currentMonth).padStart(2,"0")} se aage ke vouchers bante hain (guzre hue/past nahi). Mark Paid = exact date &amp; time + 35 din (2 vouchers = 65 din). Demo→Real convert par current month paid ho jata hai.</p>

              {notice ? <div className={cn("rounded-lg border px-3 py-2 text-sm", notice.tone === "ok" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300" : "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300")}>{notice.text}</div> : null}

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2/40 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted"><Ticket className="mr-1 inline h-3.5 w-3.5" />Vouchers ({filteredVouchers.length}{filteredVouchers.length !== vouchers.length ? ` / ${vouchers.length}` : ""})</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">{pickedCount > 0 ? `${pickedCount} selected = ${daysFor(pickedCount)} days` : "Unpaid select karein → Mark Paid"}</span>
                  <button type="button" disabled={pickedCount === 0 || !!working} onClick={() => setConfirmPaid(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-accent-fg hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
                    <BadgeCheck className="h-4 w-4" /> Mark Paid (manual)
                  </button>
                </div>
              </div>

              <div className="max-h-[320px] overflow-auto rounded-lg border border-line">
                {vLoading ? <p className="p-4 text-sm text-muted">Loading vouchers…</p> : filteredVouchers.length === 0 ? <p className="p-4 text-sm text-muted">{vouchers.length === 0 ? "No vouchers yet. Generate monthly vouchers (sirf aaj se aage)." : "Is search ke liye koi voucher nahi."}</p> : (
                  <table className="w-full min-w-[560px] text-left text-sm">
                    <thead className="bg-surface-2/60 text-xs font-semibold uppercase tracking-wide text-muted"><tr><th className="px-3 py-2">Pay</th><th className="px-3 py-2">Month</th><th className="px-3 py-2">Amount</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Paid at (date &amp; time)</th><th className="px-3 py-2">Valid until</th></tr></thead>
                    <tbody>
                      {filteredVouchers.map((v) => {
                        const canPick = v.status === "UNPAID";
                        const checked = !!picked[v.id];
                        return (
                          <tr key={v.id} className={cn("border-t border-line/70", checked && "bg-accent-soft/20")}>
                            <td className="px-3 py-2">{canPick ? <input type="checkbox" checked={checked} onChange={(e) => setPicked((p) => ({ ...p, [v.id]: e.target.checked }))} className="h-4 w-4 accent-accent" aria-label={`Mark ${v.label} paid`} /> : <span className="text-muted">—</span>}</td>
                            <td className="px-3 py-2 font-medium text-foreground">{v.label}</td>
                            <td className="px-3 py-2 tabular-nums text-foreground">{formatCurrency(v.amountPkr)}</td>
                            <td className="px-3 py-2"><span className={cn("rounded-md border px-2 py-0.5 text-xs font-medium", v.status === "PAID" ? "border-emerald-600/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "border-amber-600/20 bg-amber-500/10 text-amber-700 dark:text-amber-400")}>{v.status}</span></td>
                            <td className="px-3 py-2 text-xs text-muted">{fmtDT(v.paidAt)}</td>
                            <td className="px-3 py-2 text-xs text-muted">{fmtDT(v.validUntil)}{v.validUntil && isExpired(v.validUntil) ? <span className="ml-1 inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400"><Lock className="h-3 w-3" />expired</span> : ""}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
              <p className="flex items-start gap-1.5 text-xs text-muted"><Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" />Mark Paid (manual) = abhi ka exact time save + panel <b className="text-foreground">N×30+5 din</b> (1→35, 2→65). Expiry par auto Deactive, data preserved. Guzre hue time ke vouchers nahi bante.</p>
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={confirmPaid}
        onClose={() => setConfirmPaid(false)}
        loading={working === "paid"}
        tone="default"
        title={`Mark ${pickedCount} voucher${pickedCount > 1 ? "s" : ""} as Paid?`}
        description={<span>Business: <b>{selected?.businessName}</b>. Exact date &amp; time abhi attach hogi ({fmtDT(new Date().toISOString())}) — panel <b>{daysFor(pickedCount)} din</b> open (1→35, 2→65). Baad me <b>auto-lock (Deactive)</b>, data preserved. Account Active hoga.</span>}
        confirmLabel={`Mark Paid (${daysFor(pickedCount)} din)`}
        onConfirm={markPaid}
      />
    </div>
  );
}
