"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { ImagePlus, Loader2, PackagePlus, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AddProductModal — Hybrid inventory add form for Mobile Accessories & Gadgets.
 *
 * Tracking modes:
 *  - QUANTITY_ONLY: bulk/non-serialized (cables, covers, tempered glass). Single total stock quantity.
 *  - SERIAL_OR_IMEI: high-value serialized (smartwatches, AirPods, phones). Multiple Serial/IMEI
 *    entries (textarea / scan mode) + warranty days. stockQuantity is derived from serial count.
 */

export type TrackingType = "QUANTITY_ONLY" | "SERIAL_OR_IMEI";

export type CreatedProduct = {
  id: string;
  name: string;
  trackingType: TrackingType;
  stockQuantity: number;
  [k: string]: unknown;
};

export type ProductFeatureFlags = {
  serialEnabled?: boolean;
  batchExpiry?: boolean;
  prescription?: boolean;
  paintShade?: boolean;
  installments?: boolean;
  multiUnit?: boolean;
  serviceJobs?: boolean;
};

const UNIT_OPTIONS = ["piece", "pack", "box", "dozen", "kg", "gram", "litre", "ml", "foot", "meter", "bundle"] as const;

function parseSerials(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of input.split(/[\n,;\s]+/)) {
    const s = part.trim();
    if (!s) continue;
    if (s.length < 4 || s.length > 40 || !/^[A-Za-z0-9\-]+$/.test(s)) continue;
    const key = s.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

async function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export function AddProductModal({
  open,
  onClose,
  businessId,
  features = {},
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  businessId: string;
  /** Feature access granted by the platform admin (Access page). */
  features?: ProductFeatureFlags;
  onCreated: (product: CreatedProduct) => void;
}) {
  const serialEnabled = Boolean(features.serialEnabled);
  const panelRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [brands, setBrands] = useState<Array<{ id: string; name: string }>>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [barcode, setBarcode] = useState("");
  const [trackingType, setTrackingType] = useState<TrackingType>("QUANTITY_ONLY");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [serialText, setSerialText] = useState("");
  const [warrantyDays, setWarrantyDays] = useState("0");
  // Optional feature-gated fields
  const [batchNumber, setBatchNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [prescriptionRequired, setPrescriptionRequired] = useState(false);
  const [shadeCode, setShadeCode] = useState("");
  const [paintBase, setPaintBase] = useState("");
  const [packSize, setPackSize] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [installmentAvailable, setInstallmentAvailable] = useState(false);
  const [serviceItem, setServiceItem] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const serials = useMemo(() => parseSerials(serialText), [serialText]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setBrandsLoading(true);
    setCategoriesLoading(true);
    (async () => {
      try {
        const [bRes, cRes] = await Promise.all([
          fetch(`/api/businesses/${businessId}/brands`, { cache: "no-store" }),
          fetch(`/api/businesses/${businessId}/categories`, { cache: "no-store" }),
        ]);
        const bData = await bRes.json().catch(() => ({}));
        const cData = await cRes.json().catch(() => ({}));
        if (!cancelled) {
          if (bRes.ok) setBrands(Array.isArray(bData.brands) ? bData.brands.map((b: any) => ({ id: b.id, name: b.name })) : []);
          if (cRes.ok) setCategories(Array.isArray(cData.categories) ? cData.categories.map((c: any) => ({ id: c.id, name: c.name })) : []);
        }
      } finally {
        if (!cancelled) { setBrandsLoading(false); setCategoriesLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [open, businessId]);

  if (!open) return null;

  const reset = () => {
    setName(""); setCategoryId(""); setBrandId(""); setCostPrice(""); setSellingPrice("");
    setImageUrl(null); setTrackingType("QUANTITY_ONLY"); setStockQuantity("0");
    setSerialText(""); setWarrantyDays("0"); setError("");
    setBarcode(""); setBatchNumber(""); setExpiryDate(""); setPrescriptionRequired(false);
    setShadeCode(""); setPaintBase(""); setPackSize(""); setUnitLabel("");
    setInstallmentAvailable(false); setServiceItem(false);
  };

  const onImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please select an image file."); return; }
    try { setImageUrl(await readImage(file)); } catch { setError("Image could not be loaded."); }
    e.target.value = "";
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) { setError("Product name is required."); return; }
    const sp = Number(sellingPrice);
    if (!Number.isFinite(sp) || sp < 0) { setError("Valid selling price is required."); return; }
    const effectiveTracking: TrackingType = serialEnabled ? trackingType : "QUANTITY_ONLY";
    if (effectiveTracking === "SERIAL_OR_IMEI" && serials.length === 0) {
      setError("IMEI ya Serial number add karein.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        categoryId: categoryId || null,
        brandId: brandId || null,
        barcode: barcode.trim() || null,
        costPrice: Number(costPrice || 0),
        sellingPrice: sp,
        imageUrl,
        trackingType: effectiveTracking,
      };
      if (features.batchExpiry) {
        payload.batchNumber = batchNumber.trim() || null;
        payload.expiryDate = expiryDate || null;
      }
      if (features.prescription) payload.prescriptionRequired = prescriptionRequired;
      if (features.paintShade) {
        payload.shadeCode = shadeCode.trim() || null;
        payload.paintBase = paintBase.trim() || null;
        payload.packSize = packSize.trim() || null;
      }
      if (features.multiUnit) payload.unitLabel = unitLabel || null;
      if (features.installments) payload.installmentAvailable = installmentAvailable;
      if (features.serviceJobs) payload.serviceItem = serviceItem;
      if (effectiveTracking === "SERIAL_OR_IMEI") {
        payload.serials = serials;
        payload.warrantyDays = Math.max(0, Math.floor(Number(warrantyDays || 0)));
      } else {
        payload.stockQuantity = Math.max(0, Math.floor(Number(stockQuantity || 0)));
      }
      const res = await fetch(`/api/businesses/${businessId}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to add product.");
      onCreated(data.product as CreatedProduct);
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center" aria-modal="true" role="dialog" aria-label="Add product">
      <div className="absolute inset-0 bg-overlay/65 backdrop-blur-sm" onMouseDown={onClose} aria-hidden />
      <div ref={panelRef} className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 shadow-panel sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground"><PackagePlus className="h-4 w-4 text-accent" /> Add product / stock</h2>
            <p className="mt-0.5 text-sm text-muted">Hybrid inventory: bulk quantity or serial/IMEI tracked.</p>
          </div>
          <button type="button" onClick={onClose} className="focus-ring rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-foreground" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Product name *</label>
              <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Anker USB-C Cable" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Category (select)</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" disabled={categoriesLoading}>
                <option value="">{categoriesLoading ? "Loading categories…" : categories.length === 0 ? "No categories — Categories page se add karein" : "Select category"}</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Brand (select)</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" disabled={brandsLoading}>
                <option value="">{brandsLoading ? "Loading brands…" : brands.length === 0 ? "No brands — Brands page se add karein" : "Select brand"}</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Cost price (PKR)</label>
              <input type="number" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} placeholder="0" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Selling price (PKR) *</label>
              <input required type="number" min="0" step="0.01" value={sellingPrice} onChange={(e) => setSellingPrice(e.target.value)} placeholder="0" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted">Barcode (optional)</label>
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Scan or type the barcode" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Product image (optional)</label>
            <div className="flex items-center gap-3">
              {imageUrl ? (
                <img src={imageUrl} alt="" className="h-14 w-14 rounded-lg border border-line object-cover" />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-line bg-surface-2 text-xs text-muted">Image</span>
              )}
              <label className="focus-ring inline-flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-foreground hover:border-line-strong">
                <ImagePlus className="h-4 w-4 text-muted" aria-hidden /> Upload
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void onImage(e)} />
              </label>
              {imageUrl ? <button type="button" onClick={() => setImageUrl(null)} className="text-xs font-medium text-muted hover:text-foreground">Remove</button> : null}
            </div>
          </div>

          {/* Tracking type toggle — only when the IMEI/Serial feature is granted */}
          {serialEnabled ? (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted">Tracking type</label>
              <div className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5" role="group" aria-label="Tracking type">
                {([
                  { k: "QUANTITY_ONLY" as const, l: "Quantity only" },
                  { k: "SERIAL_OR_IMEI" as const, l: "Serial ya IMEI" },
                ]).map(({ k, l }) => (
                  <button key={k} type="button" onClick={() => setTrackingType(k)}
                    className={cn("focus-ring rounded-md px-3 py-1.5 text-sm font-medium transition-colors", trackingType === k ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground")}
                    aria-pressed={trackingType === k}>{l}</button>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
              Bulk quantity stock is active. IMEI/Serial tracking can be enabled by the platform admin from
              <b className="text-foreground"> Access</b>.
            </div>
          )}

          {!serialEnabled || trackingType === "QUANTITY_ONLY" ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Total stock quantity</label>
              <input type="number" min="0" step="1" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} className="focus-ring h-10 w-full max-w-[220px] rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground" />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">IMEI ya Serial number</label>
              <textarea
                value={serialText}
                onChange={(e) => setSerialText(e.target.value)}
                rows={3}
                placeholder="IMEI ya Serial number add karein (ek line mein ek)"
                className="focus-ring w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted"
              />
              {serials.length > 0 ? <p className="mt-1 text-xs text-muted"><span className="font-semibold tabular-nums text-foreground">{serials.length}</span> serial/IMEI</p> : null}
            </div>
          )}

          {features.batchExpiry || features.prescription || features.paintShade || features.multiUnit || features.installments || features.serviceJobs ? (
            <div className="rounded-lg border border-line bg-surface-2/60 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.04em] text-muted">Workflow options (Access-enabled)</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {features.batchExpiry ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">Batch number</label>
                      <input value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="e.g. BATCH-2026-A" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground placeholder:text-muted" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">Expiry date</label>
                      <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground" />
                    </div>
                  </>
                ) : null}
                {features.paintShade ? (
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">Shade code</label>
                      <input value={shadeCode} onChange={(e) => setShadeCode(e.target.value)} placeholder="e.g. OW-2145" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground placeholder:text-muted" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">Base type</label>
                      <input value={paintBase} onChange={(e) => setPaintBase(e.target.value)} placeholder="e.g. Water-based" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground placeholder:text-muted" />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted">Pack size</label>
                      <input value={packSize} onChange={(e) => setPackSize(e.target.value)} placeholder="e.g. 4 litre" className="focus-ring h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground placeholder:text-muted" />
                    </div>
                  </>
                ) : null}
                {features.multiUnit ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted">Selling unit</label>
                    <select value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} className="focus-ring h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground">
                      <option value="">Piece (default)</option>
                      {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                ) : null}
                <div className="flex flex-col gap-2 sm:col-span-2">
                  {features.prescription ? (
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={prescriptionRequired} onChange={(e) => setPrescriptionRequired(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                      Prescription required (Rx) — ask for doctor/prescription details at checkout
                    </label>
                  ) : null}
                  {features.installments ? (
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={installmentAvailable} onChange={(e) => setInstallmentAvailable(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                      Allow installment sale (down payment + due)
                    </label>
                  ) : null}
                  {features.serviceJobs ? (
                    <label className="flex items-center gap-2 text-sm text-foreground">
                      <input type="checkbox" checked={serviceItem} onChange={(e) => setServiceItem(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
                      Service / repair item (no stock deduction)
                    </label>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {error ? <div className="rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</div> : null}

          <div className="flex items-center justify-end gap-2 border-t border-line pt-3">
            <button type="button" onClick={onClose} className="focus-ring rounded-lg border border-line bg-surface px-3.5 py-2 text-sm font-medium text-foreground hover:border-line-strong">Cancel</button>
            <button type="submit" disabled={saving} className="focus-ring inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-fg disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackagePlus className="h-4 w-4" />}
              {serialEnabled && trackingType === "SERIAL_OR_IMEI" ? `Add product (${serials.length} serials)` : "Add product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
