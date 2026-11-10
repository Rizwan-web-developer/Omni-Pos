"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  Check,
  ClipboardCheck,
  Pill,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";

import { DialogShell } from "@/components/ui/DialogShell";
import { useToast } from "@/components/providers/ToastProvider";
import { cn, daysUntil, formatDate, formatMoney } from "@/lib/utils";

interface Batch {
  id: string;
  batchNo: string;
  qty: number;
  expiry: string;
}

interface Medicine {
  id: string;
  name: string;
  strength: string;
  form: string;
  manufacturer: string;
  ndc: string;
  price: number;
  batches: Batch[];
}

const MEDICINES: Medicine[] = [
  { id: "amoxicillin", name: "Amoxicillin", strength: "500mg", form: "Oral capsules", manufacturer: "Teva Pharm", ndc: "0093-3109-01", price: 18.5, batches: [
    { id: "amx-b9", batchNo: "AMX-2024-B9", qty: 420, expiry: "2027-04-30" },
    { id: "amx-c2", batchNo: "AMX-2025-C2", qty: 85, expiry: "2026-12-20" },
  ]},
  { id: "lipitor", name: "Lipitor (Atorvastatin)", strength: "20mg", form: "Film-coated tablets", manufacturer: "Pfizer Ltd", ndc: "0071-0156-23", price: 42, batches: [
    { id: "lip-081", batchNo: "LIP-24-081", qty: 60, expiry: "2026-12-12" },
    { id: "lip-114", batchNo: "LIP-25-114", qty: 120, expiry: "2027-08-31" },
  ]},
  { id: "ventolin", name: "Ventolin HFA Inhaler", strength: "90mcg", form: "Aerosol 18g", manufacturer: "GlaxoSmithKline", ndc: "0173-0682-20", price: 64, batches: [
    { id: "vt-9921", batchNo: "VT-9921-X", qty: 18, expiry: "2027-01-31" },
    { id: "vt-2411", batchNo: "VT-2024-11", qty: 6, expiry: "2026-10-01" },
  ]},
  { id: "metformin", name: "Metformin HCl ER", strength: "1000mg", form: "Extended release", manufacturer: "Ascend Labs", ndc: "50090-2831-0", price: 14.2, batches: [
    { id: "met-c1", batchNo: "MET-2025-C1", qty: 310, expiry: "2027-03-31" },
    { id: "met-d8", batchNo: "MET-2026-D8", qty: 140, expiry: "2026-11-30" },
  ]},
  { id: "ozempic", name: "Ozempic Pen", strength: "1mg", form: "Subcutaneous injection", manufacturer: "Novo Nordisk", ndc: "0169-4181-13", price: 189, batches: [
    { id: "ozm-05", batchNo: "OZM-25-05", qty: 24, expiry: "2027-06-30" },
    { id: "ozm-06", batchNo: "OZM-25-06", qty: 12, expiry: "2027-09-30" },
  ]},
  { id: "augmentin", name: "Augmentin", strength: "625mg", form: "Film-coated tablets", manufacturer: "GSK Pharma", ndc: "43598-0222-1", price: 26.4, batches: [
    { id: "aug-d4", batchNo: "AUG-2024-D4", qty: 34, expiry: "2026-11-30" },
    { id: "aug-e1", batchNo: "AUG-2026-E1", qty: 90, expiry: "2027-10-31" },
  ]},
];

type ExpiryTone = "safe" | "warning" | "critical" | "expired";

interface ExpiryInfo {
  tone: ExpiryTone;
  days: number;
  label: string;
}

const EXPIRY_CLASSES: Record<ExpiryTone, string> = {
  safe: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  critical: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  expired: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

function expiryInfo(expiry: string): ExpiryInfo {
  const days = daysUntil(expiry);
  if (days < 0) return { tone: "expired", days, label: `Expired ${Math.abs(days)}d ago` };
  if (days <= 30) return { tone: "critical", days, label: `${days}d left` };
  if (days <= 90) return { tone: "warning", days, label: `${days}d left · FEFO` };
  return { tone: "safe", days, label: formatDate(expiry) };
}

function fefoBatch(medicine: Medicine): Batch | undefined {
  return [...medicine.batches]
    .filter((batch) => batch.qty > 0 && expiryInfo(batch.expiry).tone !== "expired")
    .sort((a, b) => a.expiry.localeCompare(b.expiry))[0];
}

const INITIAL_BATCH_CHOICES: Record<string, string> = Object.fromEntries(
  MEDICINES.map((medicine) => [medicine.id, (fefoBatch(medicine) ?? medicine.batches[0]).id]),
);

interface QueueLine {
  medicineId: string;
  batchId: string;
  qty: number;
}

export function PharmacyPOS() {
  const { pushToast } = useToast();

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(MEDICINES[0].id);
  const [batchChoices, setBatchChoices] = useState(INITIAL_BATCH_CHOICES);
  const [cart, setCart] = useState<QueueLine[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [verified, setVerified] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const verifyRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return MEDICINES;
    return MEDICINES.filter((medicine) =>
      [medicine.name, medicine.strength, medicine.form, medicine.manufacturer, medicine.ndc]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  const selectedMedicine =
    filtered.find((medicine) => medicine.id === selectedId) ??
    MEDICINES.find((medicine) => medicine.id === selectedId) ??
    filtered[0] ??
    MEDICINES[0];

  const selectedBatch = selectedMedicine
    ? selectedMedicine.batches.find((batch) => batch.id === batchChoices[selectedMedicine.id]) ??
      fefoBatch(selectedMedicine) ??
      selectedMedicine.batches[0]
    : null;

  const queueDetailed = useMemo(
    () =>
      cart.map((line) => {
        const medicine = MEDICINES.find((item) => item.id === line.medicineId)!;
        const batch = medicine.batches.find((item) => item.id === line.batchId)!;
        return { ...line, medicine, batch };
      }),
    [cart],
  );

  const subtotal = queueDetailed.reduce((sum, line) => sum + line.medicine.price * line.qty, 0);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (filtered.length > 0 && !filtered.some((medicine) => medicine.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const inCartForBatch = (medicineId: string, batchId: string) =>
    cart.filter((line) => line.medicineId === medicineId && line.batchId === batchId).reduce((sum, line) => sum + line.qty, 0);

  const inCartForMedicine = (medicineId: string) =>
    cart.filter((line) => line.medicineId === medicineId).reduce((sum, line) => sum + line.qty, 0);

  const addToCart = (medicine = selectedMedicine, batch = selectedBatch) => {
    if (!medicine || !batch) return;
    if (expiryInfo(batch.expiry).tone === "expired") {
      pushToast({ tone: "error", title: "Expired batch blocked", description: `${batch.batchNo} is past expiry and cannot leave the shelf.` });
      return;
    }
    const inCart = inCartForBatch(medicine.id, batch.id);
    if (inCart >= batch.qty) {
      pushToast({ tone: "warning", title: "Batch exhausted", description: `${batch.batchNo} has no dispenseable units left.` });
      return;
    }
    setCart((current) => {
      const existing = current.find((line) => line.medicineId === medicine.id && line.batchId === batch.id);
      if (existing) return current.map((line) => (line === existing ? { ...line, qty: line.qty + 1 } : line));
      return [...current, { medicineId: medicine.id, batchId: batch.id, qty: 1 }];
    });
    const info = expiryInfo(batch.expiry);
    pushToast({
      tone: info.tone === "warning" || info.tone === "critical" ? "warning" : "success",
      title: `${medicine.name} ${medicine.strength} queued`,
      description: `Batch ${batch.batchNo} · ${info.label}.`,
    });
  };

  const openReview = () => {
    if (cart.length === 0) {
      pushToast({ tone: "warning", title: "Dispense queue is empty", description: "Add at least one batch before opening the review." });
      searchRef.current?.focus();
      return;
    }
    setVerified(false);
    setReviewOpen(true);
  };

  const completeDispense = () => {
    if (!verified) {
      pushToast({ tone: "warning", title: "Pharmacist verification required", description: "Check the verification box before dispensing." });
      verifyRef.current?.focus();
      return;
    }
    pushToast({ tone: "success", title: "Dispense complete", description: `${queueDetailed.length} line(s) · ${formatMoney(subtotal)} · labels sent to printer.` });
    setCart([]);
    setVerified(false);
    setReviewOpen(false);
    window.requestAnimationFrame(() => searchRef.current?.focus());
  };

  const alerts = useMemo(() => {
    return MEDICINES.flatMap((medicine) =>
      medicine.batches.map((batch) => ({ medicine, batch, info: expiryInfo(batch.expiry) })),
    )
      .filter((entry) => entry.info.tone !== "safe")
      .sort((a, b) => a.info.days - b.info.days);
  }, []);

  const activeAlerts = alerts.filter((alert) => alert.info.tone !== "expired").length;
  const expiredAlerts = alerts.filter((alert) => alert.info.tone === "expired").length;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <Pill className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">Pharmacy POS Terminal</h1>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-600/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active station
                </span>
              </div>
              <p className="mt-0.5 text-sm text-muted">Rx Dispensing Lane 02 · Dr. Sarah Lin, PharmD · License #PH-88912</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-muted"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden />Rx verify online</span>
            <span className="hidden items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-muted sm:flex"><BadgeCheck className="h-3.5 w-3.5 text-accent" aria-hidden />21 CFR Part 11</span>
            <span className="flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-muted"><ClipboardCheck className="h-3.5 w-3.5 text-violet-500" aria-hidden />14,290 formulations</span>
          </div>
        </div>
      </section>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-3">
          <section className="overflow-hidden rounded-xl border border-line bg-surface" aria-labelledby="dispense-grid-title">
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Pill className="h-4 w-4 text-muted" aria-hidden />
                <h2 id="dispense-grid-title" className="text-base font-semibold text-foreground">Fast dispense grid</h2>
                <span className="rounded-full border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">{filtered.length}/{MEDICINES.length}</span>
              </div>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  ref={searchRef}
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search formulation, NDC, manufacturer…"
                  aria-label="Search medicines"
                  className="focus-ring h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-9 text-sm text-foreground placeholder:text-muted"
                />
                {query ? (
                  <button type="button" onClick={() => { setQuery(""); searchRef.current?.focus(); }} className="focus-ring absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:text-foreground" aria-label="Clear medicine search">
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
                <Pill className="h-6 w-6 text-muted" aria-hidden />
                <p className="text-sm font-medium text-foreground">No formulation found</p>
                <p className="text-sm text-muted">Clear the search to restore the formulary.</p>
              </div>
            ) : (
              <div className="grid gap-2 p-3 sm:grid-cols-2">
                {filtered.map((medicine) => {
                  const batch = medicine.batches.find((item) => item.id === batchChoices[medicine.id]);
                  const info = batch ? expiryInfo(batch.expiry) : null;
                  const queued = inCartForMedicine(medicine.id);
                  const totalStock = medicine.batches.reduce((sum, item) => sum + Math.max(0, item.qty - inCartForBatch(medicine.id, item.id)), 0);
                  const isSelected = selectedId === medicine.id;
                  return (
                    <button
                      key={medicine.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(medicine.id);
                        addToCart(medicine, batch);
                      }}
                      className={cn(
                        "focus-ring rounded-xl border p-3.5 text-left transition-colors",
                        isSelected ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:border-line-strong hover:bg-surface-2",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {medicine.name} <span className="font-normal text-muted">{medicine.strength}</span>
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted">{medicine.form} · {medicine.manufacturer}</p>
                        </div>
                        {queued > 0 ? <span className="shrink-0 rounded border border-accent-line bg-surface px-2 py-0.5 text-xs font-medium text-accent">{queued} in cart</span> : null}
                      </div>
                      <div className="mt-2 flex items-end justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs text-muted">{medicine.ndc}</p>
                          <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-foreground">{formatMoney(medicine.price)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted">{totalStock} units</p>
                          {info ? (
                            <span className={cn("mt-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-semibold", EXPIRY_CLASSES[info.tone])}>
                              <CalendarClock className="h-3 w-3" aria-hidden />
                              {info.label}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {batch ? <p className="mt-2 truncate font-mono text-xs text-muted">FEFO {batch.batchNo}</p> : null}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-line bg-surface-2 px-4 py-3 text-xs text-muted">
              <span>Select a formulation to add its FEFO batch to the queue.</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" aria-hidden />FEFO enforced</span>
            </div>
          </section>
        </div>

        <div className="space-y-3">
          {selectedMedicine && selectedBatch ? (
            <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="batch-title">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 id="batch-title" className="truncate text-base font-semibold text-foreground">{selectedMedicine.name} {selectedMedicine.strength}</h2>
                  <p className="mt-0.5 truncate text-xs text-muted">{selectedMedicine.form} · {selectedMedicine.ndc}</p>
                </div>
                <span className="shrink-0 font-mono text-sm font-semibold text-foreground">{formatMoney(selectedMedicine.price)}</span>
              </div>

              <label htmlFor="batch-select" className="mt-3 mb-1.5 block text-xs font-medium text-muted">Batch · FEFO default</label>
              <select
                id="batch-select"
                value={selectedBatch.id}
                onChange={(event) => setBatchChoices((current) => ({ ...current, [selectedMedicine.id]: event.target.value }))}
                className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground"
              >
                {selectedMedicine.batches.map((batch) => {
                  const info = expiryInfo(batch.expiry);
                  const available = Math.max(0, batch.qty - inCartForBatch(selectedMedicine.id, batch.id));
                  return (
                    <option key={batch.id} value={batch.id} disabled={info.tone === "expired"}>
                      {batch.batchNo} · {available} units · {info.label}
                    </option>
                  );
                })}
              </select>

              <div className={cn("mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm", EXPIRY_CLASSES[expiryInfo(selectedBatch.expiry).tone])}>
                {expiryInfo(selectedBatch.expiry).tone === "safe" ? <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
                <span>
                  <span className="block font-semibold">{expiryInfo(selectedBatch.expiry).tone === "safe" ? "Batch compliant" : "Expiry watch"}</span>
                  Expires {formatDate(selectedBatch.expiry)} · {expiryInfo(selectedBatch.expiry).label}
                </span>
              </div>

              <button type="button" onClick={() => addToCart()} className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover">
                Add to dispense queue
              </button>
            </section>
          ) : null}

          <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="queue-title">
            <div className="flex items-center justify-between">
              <h2 id="queue-title" className="text-base font-semibold text-foreground">Dispense queue</h2>
              <span className="rounded-full border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-xs text-muted">{queueDetailed.length}</span>
            </div>
            {queueDetailed.length === 0 ? (
              <p className="mt-3 rounded-lg border border-dashed border-line px-3 py-5 text-center text-sm text-muted">Select a formulation to queue its FEFO batch.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {queueDetailed.map((line) => (
                  <li key={`${line.medicineId}-${line.batchId}`} className="flex items-start gap-2 rounded-lg border border-line bg-surface-2 p-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded border border-line bg-surface text-xs font-semibold text-muted">{line.qty}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{line.medicine.name} {line.medicine.strength}</p>
                      <p className="mt-0.5 truncate font-mono text-xs text-muted">{line.batch.batchNo} · {formatDate(line.batch.expiry)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="font-mono text-sm font-semibold text-foreground">{formatMoney(line.medicine.price * line.qty)}</span>
                      <button
                        type="button"
                        onClick={() => setCart((current) => current.filter((entry) => !(entry.medicineId === line.medicineId && entry.batchId === line.batchId)))}
                        className="focus-ring rounded p-1 text-muted hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-400"
                        aria-label={`Remove ${line.medicine.name} ${line.batch.batchNo}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="font-mono text-foreground">{formatMoney(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Coverage</dt><dd className="text-emerald-700 dark:text-emerald-400">Insurance on file</dd></div>
              <div className="flex justify-between border-t border-line pt-1.5"><dt className="font-semibold text-foreground">Patient due</dt><dd className="font-mono text-base font-semibold text-foreground">{formatMoney(subtotal * 0.2)}</dd></div>
            </dl>
            <button type="button" onClick={openReview} disabled={queueDetailed.length === 0} className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40">
              <ClipboardCheck className="h-4 w-4" aria-hidden />
              Review &amp; dispense
            </button>
          </section>

          <section className="rounded-xl border border-line bg-surface p-4" aria-labelledby="alerts-title">
            <div className="flex items-center justify-between">
              <h2 id="alerts-title" className="flex items-center gap-2 text-base font-semibold text-foreground"><AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden />Expiry watch</h2>
              <span className="text-xs text-muted">{activeAlerts} expiring · {expiredAlerts} expired</span>
            </div>
            <ul className="mt-3 space-y-2">
              {alerts.slice(0, 4).map((alert) => (
                <li key={`${alert.medicine.id}-${alert.batch.id}`} className={cn("rounded-lg border px-3 py-2.5", alert.info.tone === "expired" ? "border-rose-500/30 bg-rose-500/[0.07]" : "border-amber-500/25 bg-amber-500/[0.06]")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{alert.medicine.name} {alert.medicine.strength}</span>
                    <span className="shrink-0 font-mono text-xs text-muted">{alert.batch.batchNo}</span>
                  </div>
                  <p className={cn("mt-0.5 text-xs font-medium", alert.info.tone === "expired" ? "text-rose-700 dark:text-rose-400" : "text-amber-700 dark:text-amber-300")}>
                    {alert.info.tone === "expired" ? "Expired · quarantined from dispensing" : `Expiry ${formatDate(alert.batch.expiry)} · ${alert.info.label}`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <DialogShell open={reviewOpen} onClose={() => setReviewOpen(false)} labelledBy="dispense-review-title" side="right" initialFocusRef={verifyRef} panelClassName="flex flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted">Dispense review</p>
            <h2 id="dispense-review-title" className="mt-1 text-xl font-semibold text-foreground">Verify {queueDetailed.length} line(s)</h2>
            <p className="mt-0.5 text-sm text-muted">Rx Lane 02 · Dr. Sarah Lin, PharmD</p>
          </div>
          <button type="button" onClick={() => setReviewOpen(false)} className="focus-ring -m-1 rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-foreground" aria-label="Close dispense review">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-2.5">
            {queueDetailed.map((line) => {
              const info = expiryInfo(line.batch.expiry);
              return (
                <li key={`${line.medicineId}-${line.batchId}`} className="rounded-lg border border-line bg-surface-2 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{line.medicine.name} {line.medicine.strength}</p>
                      <p className="mt-0.5 text-xs text-muted">{line.medicine.form} · Qty {line.qty}</p>
                    </div>
                    <span className="shrink-0 font-mono text-sm font-semibold text-foreground">{formatMoney(line.medicine.price * line.qty)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-xs">
                    <span className="rounded border border-line bg-surface px-1.5 py-0.5 text-muted">{line.batch.batchNo}</span>
                    <span className={cn("rounded border px-1.5 py-0.5 font-semibold", EXPIRY_CLASSES[info.tone])}>{info.label}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="mt-4 rounded-lg border border-line bg-surface-2 p-3.5">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Subtotal</dt><dd className="font-mono text-foreground">{formatMoney(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Insurance coverage</dt><dd className="font-mono text-foreground">-{formatMoney(subtotal * 0.8)}</dd></div>
              <div className="flex justify-between border-t border-line pt-1.5"><dt className="font-semibold text-foreground">Patient due</dt><dd className="font-mono font-semibold text-foreground">{formatMoney(subtotal * 0.2)}</dd></div>
            </dl>
          </div>
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-accent-line bg-accent-soft p-3.5 text-sm text-muted">
            <input ref={verifyRef} type="checkbox" checked={verified} onChange={(event) => setVerified(event.target.checked)} className="mt-0.5 h-4 w-4 accent-accent" />
            <span>
              <span className="block font-semibold text-foreground">Pharmacist verification complete</span>
              Batch numbers, expiry dates and FEFO allocation have been reviewed for this patient. This attestation is written to the audit log.
            </span>
          </label>
          {queueDetailed.some((line) => expiryInfo(line.batch.expiry).days <= 30) ? (
            <p className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-600/30 bg-amber-500/[0.07] px-3 py-2.5 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              One or more batches expire within 30 days. Counsel the patient and document the short-dated supply.
            </p>
          ) : null}
        </div>
        <div className="border-t border-line bg-surface px-5 py-4">
          <button type="button" onClick={completeDispense} disabled={!verified} className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-3.5 py-3 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40">
            <UserCheck className="h-4 w-4" aria-hidden />
            Dispense &amp; print labels
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </DialogShell>
    </div>
  );
}
