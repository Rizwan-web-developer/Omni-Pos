"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, Plus, Trash2, Truck, X } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn, formatCurrency } from "@/lib/utils";

type SupplierEntry = { id: string; type: "PURCHASE" | "PAYMENT"; amountPkr: number; note?: string | null; createdAt: string };
type Supplier = {
  id: string;
  name: string;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
  openingBalancePkr: number;
  purchasesPkr: number;
  paymentsPkr: number;
  balancePkr: number;
  entries: SupplierEntry[];
};

export function SuppliersView({ businessId }: { businessId: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [opening, setOpening] = useState("");

  const [entryType, setEntryType] = useState<"PURCHASE" | "PAYMENT">("PURCHASE");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryNote, setEntryNote] = useState("");
  const [entryBusy, setEntryBusy] = useState(false);

  const [delSupplier, setDelSupplier] = useState<Supplier | null>(null);
  const [delEntry, setDelEntry] = useState<SupplierEntry | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to load suppliers.");
      const list = Array.isArray(data.suppliers) ? (data.suppliers as Supplier[]) : [];
      setSuppliers(list);
      setSelectedId((cur) => (cur && list.some((s) => s.id === cur) ? cur : list[0]?.id ?? null));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load suppliers.");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => { void load(); }, [load]);

  const selected = suppliers.find((s) => s.id === selectedId) ?? null;
  const totalPayable = suppliers.reduce((sum, s) => sum + Math.max(0, s.balancePkr), 0);

  const createSupplier = async () => {
    setError(""); setNotice("");
    if (name.trim().length < 2) { setError("Supplier name likhein."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, address, openingBalancePkr: Number(opening || 0) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to create supplier.");
      const supplier = data.supplier as Supplier;
      setSuppliers((cur) => [...cur, supplier].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(supplier.id);
      setAddOpen(false);
      setName(""); setPhone(""); setAddress(""); setOpening("");
      setNotice("Supplier added.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create supplier.");
    } finally {
      setSaving(false);
    }
  };

  const addEntry = async () => {
    if (!selected) return;
    setError(""); setNotice("");
    const amount = Number(entryAmount);
    if (!Number.isFinite(amount) || amount <= 0) { setError("Valid amount likhein."); return; }
    setEntryBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${selected.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: entryType, amountPkr: amount, note: entryNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to add entry.");
      setEntryAmount(""); setEntryNote("");
      setNotice(`${entryType === "PURCHASE" ? "Purchase" : "Payment"} recorded.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add entry.");
    } finally {
      setEntryBusy(false);
    }
  };

  const deleteSupplier = async () => {
    if (!delSupplier) return;
    setDelBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${delSupplier.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete supplier.");
      setSuppliers((cur) => cur.filter((s) => s.id !== delSupplier.id));
      if (selectedId === delSupplier.id) setSelectedId(null);
      setDelSupplier(null);
      setNotice("Supplier deleted.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete supplier.");
    } finally {
      setDelBusy(false);
    }
  };

  const deleteEntry = async () => {
    if (!delEntry || !selected) return;
    setDelBusy(true);
    try {
      const res = await fetch(`/api/businesses/${businessId}/suppliers/${selected.id}/entries?entryId=${encodeURIComponent(delEntry.id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to delete entry.");
      setDelEntry(null);
      setNotice("Ledger entry deleted.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete entry.");
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-foreground"><Truck className="h-5 w-5 text-accent" /> Suppliers</h1>
          <p className="mt-0.5 text-sm text-muted">Supplier credit ledger — purchases increase payable, payments reduce it.</p>
        </div>
        <button type="button" onClick={() => setAddOpen(true)} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg">
          <Plus className="h-4 w-4" /> Add supplier
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ["Suppliers", String(suppliers.length), "registered"],
          ["Total payable", formatCurrency(totalPayable), "outstanding credit"],
          ["Ledger entries", String(suppliers.reduce((s, x) => s + x.entries.length, 0)), "purchases + payments"],
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

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 py-12 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading suppliers…</div>
      ) : suppliers.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-12 text-center text-sm text-muted">No suppliers yet. Add your first supplier to start the credit ledger.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
          <section className="overflow-hidden rounded-xl border border-line bg-surface">
            <ul className="divide-y divide-line">
              {suppliers.map((s) => (
                <li key={s.id}>
                  <button type="button" onClick={() => setSelectedId(s.id)} className={cn("focus-ring flex w-full items-center justify-between gap-2 px-4 py-3 text-left", selectedId === s.id ? "bg-accent-soft" : "hover:bg-surface-2/60")}>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">{s.name}</span>
                      <span className="block text-xs text-muted">{s.phone || "No phone"}</span>
                    </span>
                    <span className={cn("shrink-0 text-sm font-semibold tabular-nums", s.balancePkr > 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300")}>{formatCurrency(s.balancePkr)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {selected ? (
            <section className="space-y-4">
              <div className="rounded-xl border border-line bg-surface p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">{selected.name}</h2>
                    <p className="text-xs text-muted">{[selected.phone, selected.address].filter(Boolean).join(" · ") || "No contact details"}</p>
                  </div>
                  <button type="button" onClick={() => setDelSupplier(selected)} className="focus-ring inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-muted hover:border-rose-400/40 hover:text-rose-600"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <div className="rounded-lg border border-line bg-surface-2 px-3 py-2"><p className="text-[11px] text-muted">Opening</p><p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(selected.openingBalancePkr)}</p></div>
                  <div className="rounded-lg border border-line bg-surface-2 px-3 py-2"><p className="text-[11px] text-muted">Purchases</p><p className="text-sm font-semibold tabular-nums text-rose-600 dark:text-rose-400">{formatCurrency(selected.purchasesPkr)}</p></div>
                  <div className="rounded-lg border border-line bg-surface-2 px-3 py-2"><p className="text-[11px] text-muted">Payments</p><p className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">{formatCurrency(selected.paymentsPkr)}</p></div>
                  <div className="rounded-lg border border-accent-line bg-accent-soft px-3 py-2"><p className="text-[11px] text-muted">Balance payable</p><p className="text-sm font-semibold tabular-nums text-foreground">{formatCurrency(selected.balancePkr)}</p></div>
                </div>
              </div>

              <div className="rounded-xl border border-line bg-surface p-4">
                <h3 className="text-sm font-semibold text-foreground">Add ledger entry</h3>
                <div className="mt-3 flex flex-wrap items-end gap-2">
                  <label className="text-xs font-medium text-muted"><span className="mb-1 block">Type</span>
                    <select value={entryType} onChange={(e) => setEntryType(e.target.value as "PURCHASE" | "PAYMENT")} className="focus-ring h-10 rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground">
                      <option value="PURCHASE">Purchase (payable ↑)</option>
                      <option value="PAYMENT">Payment (payable ↓)</option>
                    </select>
                  </label>
                  <label className="text-xs font-medium text-muted"><span className="mb-1 block">Amount ($)</span>
                    <input type="number" min="0" step="0.01" value={entryAmount} onChange={(e) => setEntryAmount(e.target.value)} className="focus-ring h-10 w-32 rounded-lg border border-line bg-surface-2 px-3 text-sm tabular-nums text-foreground" />
                  </label>
                  <label className="min-w-[180px] flex-1 text-xs font-medium text-muted"><span className="mb-1 block">Note</span>
                    <input value={entryNote} onChange={(e) => setEntryNote(e.target.value)} placeholder="Invoice / bill reference" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
                  </label>
                  <button type="button" disabled={entryBusy} onClick={() => void addEntry()} className="focus-ring inline-flex h-10 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-fg disabled:opacity-60">
                    {entryBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
                  </button>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-line bg-surface">
                <div className="border-b border-line px-4 py-3"><h3 className="text-sm font-semibold text-foreground">Ledger history</h3></div>
                {selected.entries.length === 0 ? (
                  <p className="px-4 py-8 text-center text-sm text-muted">No entries yet.</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {selected.entries.map((entry) => (
                      <li key={entry.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full", entry.type === "PURCHASE" ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>
                          {entry.type === "PURCHASE" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{entry.type === "PURCHASE" ? "Purchase" : "Payment"}{entry.note ? <span className="font-normal text-muted"> · {entry.note}</span> : null}</p>
                          <p className="text-[11px] text-muted">{new Date(entry.createdAt).toLocaleString("en-PK")}</p>
                        </div>
                        <span className={cn("text-sm font-semibold tabular-nums", entry.type === "PURCHASE" ? "text-rose-600 dark:text-rose-400" : "text-emerald-700 dark:text-emerald-300")}>
                          {entry.type === "PURCHASE" ? "+" : "−"} {formatCurrency(entry.amountPkr)}
                        </span>
                        <button type="button" onClick={() => setDelEntry(entry)} className="focus-ring rounded-md p-1 text-muted hover:text-rose-600" aria-label="Delete entry"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}

      {addOpen ? (
        <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Add supplier">
          <div className="absolute inset-0 bg-overlay/65 backdrop-blur-sm" onMouseDown={() => (saving ? null : setAddOpen(false))} aria-hidden />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-line bg-surface p-5 shadow-panel sm:rounded-2xl">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-base font-semibold text-foreground">Add supplier</h2>
              <button type="button" onClick={() => (saving ? null : setAddOpen(false))} className="rounded-md p-1 text-muted hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Supplier name *</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Phone</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Address</span>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
              </label>
              <label className="text-sm"><span className="mb-1 block text-xs font-medium text-muted">Opening balance payable ($)</span>
                <input type="number" min="0" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} placeholder="0" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm tabular-nums text-foreground placeholder:text-muted" />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" disabled={saving} onClick={() => setAddOpen(false)} className="focus-ring rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-foreground disabled:opacity-50">Cancel</button>
              <button type="button" disabled={saving} onClick={() => void createSupplier()} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add supplier
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={!!delSupplier}
        onClose={() => (delBusy ? undefined : setDelSupplier(null))}
        onConfirm={() => void deleteSupplier()}
        title="Delete supplier?"
        description={delSupplier ? <span>{delSupplier.name} aur uski tamam ledger entries delete ho jayengi.</span> : null}
        confirmLabel="Delete"
        tone="danger"
        loading={delBusy}
      />

      <ConfirmDialog
        open={!!delEntry}
        onClose={() => (delBusy ? undefined : setDelEntry(null))}
        onConfirm={() => void deleteEntry()}
        title="Delete ledger entry?"
        description={delEntry ? <span>{formatCurrency(delEntry.amountPkr)} ki {delEntry.type === "PURCHASE" ? "purchase" : "payment"} entry delete ho jayegi.</span> : null}
        confirmLabel="Delete"
        tone="danger"
        loading={delBusy}
      />
    </div>
  );
}
